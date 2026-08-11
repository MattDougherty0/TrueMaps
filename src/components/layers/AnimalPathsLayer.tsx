import { useEffect, useRef, useState } from "react";
import { useMapInstance } from "../../state/map";
import useAppStore from "../../state/store";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Draw, Select } from "ol/interaction";
import { Stroke, Style, Text as TextStyle, Fill } from "ol/style";
import { v4 as uuidv4 } from "uuid";
import type Feature from "ol/Feature";
import type LineString from "ol/geom/LineString";
import FeatureForm from "../FeatureForm";
import { useHuntSelection } from "../../state/hunts";
import { shouldShowFeature } from "../../lib/geo/filters";
import { useUserStore } from "../../state/user";
import { useSelectionStore } from "../../state/selection";
import { useVisibilityStore } from "../../state/visibility";
import { emptyFeatureCollectionString, propertyScopedGeoJSONPath } from "../../lib/geo/propertyScopedFiles";
import { createLazyLayerLoader } from "../../lib/perf/lazyLayerData";
import { borderRadius, colors, spacing, typography } from "../../lib/theme";

const pathStyle = (feature?: Feature<LineString>) =>
	new Style({
		stroke: new Stroke({
			color: "#00695c",
			width: 3
		}),
		text:
			feature?.get?.("name")
				? new TextStyle({
						text: String(feature.get("name")),
						font: "12px 'Inter', sans-serif",
						fill: new Fill({ color: "#ffffff" }),
						stroke: new Stroke({ color: "rgba(0,0,0,0.6)", width: 3 }),
						placement: "line",
						overflow: true
				  })
				: undefined
	});

export default function AnimalPathsLayer() {
	const { projectPath, activePropertyId } = useAppStore();
	const map = useMapInstance();
	const sourceRef = useRef<VectorSource>(new VectorSource());
	const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
	const drawRef = useRef<Draw | null>(null);
	const selectRef = useRef<Select | null>(null);
	const modifyRef = useRef<any | null>(null);
	const selectedHuntId = useHuntSelection((s) => s.selectedHuntId);
	const persistRef = useRef<() => Promise<void>>(async () => {});

	const [pending, setPending] = useState<{
		feature: Feature<LineString>;
		initial: Record<string, unknown>;
	} | null>(null);

	useEffect(() => {
		if (!map || !projectPath) return;
		const dataPath = propertyScopedGeoJSONPath("data/animal_paths.geojson", activePropertyId);

		const layer = new VectorLayer({
			source: sourceRef.current,
			style: (feat) => (shouldShowFeature("animal_paths", feat) ? pathStyle(feat as Feature<LineString>) : undefined)
		});
		layerRef.current = layer;
		map.addLayer(layer);

		// Load existing
		const reload = async () => {
			try {
				const text = await window.api.readTextFile(
					projectPath,
					dataPath
				);
				const geojson = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
				const feats = new GeoJSON().readFeatures(geojson, {
					dataProjection: "EPSG:4326",
					featureProjection: "EPSG:3857"
				});
				sourceRef.current.clear();
				sourceRef.current.addFeatures(feats as any);
				let changed = false;
				const existing = sourceRef.current.getFeatures() as Feature<LineString>[];
				existing.forEach((f, i) => {
					if (!f.get("name")) {
						f.set("name", `Path ${i + 1}`);
						changed = true;
					}
					if (!f.get("path_id")) {
						f.set("path_id", uuidv4());
						changed = true;
					}
				});
				if (changed) {
					await persistRef.current();
				}
			} catch {
				try {
					await window.api.writeTextFile(projectPath, dataPath, emptyFeatureCollectionString());
				} catch {
					// ignore
				}
			}
		};
		const lazy = createLazyLayerLoader("animal_paths", reload);
		lazy.loadIfVisible();
		const onReloadAll = () => lazy.onReloadAll();

		const persist = async () => {
			if (!projectPath) return;
			const gj = new GeoJSON().writeFeaturesObject(sourceRef.current.getFeatures(), {
				dataProjection: "EPSG:4326",
				featureProjection: "EPSG:3857"
			});
			await window.api.writeTextFile(projectPath, dataPath, JSON.stringify(gj, null, 2));
		};
		persistRef.current = persist;

		const startDraw = () => {
			if (drawRef.current) return;
			const draw = new Draw({ source: sourceRef.current, type: "LineString" });
			drawRef.current = draw;
			map.addInteraction(draw);
			draw.on("drawend", (evt) => {
				const f = evt.feature as Feature<LineString>;
				const initial = {
					path_id: uuidv4(),
					name: `Path ${sourceRef.current.getFeatures().length}`,
					hunt_id: selectedHuntId || "",
					species: "whitetail",
					confidence: "observed",
					notes: ""
				};
				setPending({ feature: f, initial });
				if (drawRef.current) {
					map.removeInteraction(drawRef.current);
					drawRef.current = null;
				}
			});
		};

		const onStartNew = () => {
			lazy.requestData();
			startDraw();
		};
		const select = new Select({ layers: [layer] as any });
		selectRef.current = select;
		map.addInteraction(select);
		select.on("select", (e) => {
			const f = (e.selected?.[0] as Feature<LineString> | undefined) || null;
			useSelectionStore.getState().setSelected(f ? { layerId: "animal_paths", feature: f } : null);
		});
		const enableModify = () => {
			const activeUser = useUserStore.getState().activeUser;
			if (!activeUser) {
				window.alert("Please select an Active User before editing geometry.");
				return;
			}
			if (modifyRef.current) return;
			const mod = new (require("ol/interaction").Modify)({ source: sourceRef.current });
			modifyRef.current = mod;
			map.addInteraction(mod);
			mod.on("modifyend", (evt: any) => {
				const user = useUserStore.getState().activeUser;
				if (!user) return;
				evt.features?.forEach?.((f: any) => {
					f.set("updated_by", user);
					f.set("updated_at", new Date().toISOString());
				});
				void persistRef.current();
			});
		};
		const disableModify = () => {
			if (!modifyRef.current) return;
			map.removeInteraction(modifyRef.current);
			modifyRef.current = null;
		};
		const onEnable = () => enableModify();
		const onDisable = () => disableModify();
		window.addEventListener("layer:enable-modify:animal_paths", onEnable);
		window.addEventListener("layer:disable-modify:animal_paths", onDisable);
		window.addEventListener("start-new-animal-path", onStartNew);
		window.addEventListener("layers:reload", onReloadAll);

		// Visibility binding
		const updateVisibility = () => {
			if (!layerRef.current) return;
			const visible = useVisibilityStore.getState().isLayerVisible("animal_paths");
			layerRef.current.setVisible(visible);
			if (visible) lazy.loadIfVisible();
		};
		updateVisibility();
		const unsubVisibility = useVisibilityStore.subscribe(updateVisibility);

		return () => {
			window.removeEventListener("start-new-animal-path", onStartNew);
			window.removeEventListener("layer:enable-modify:animal_paths", onEnable);
			window.removeEventListener("layer:disable-modify:animal_paths", onDisable);
			window.removeEventListener("layers:reload", onReloadAll);
			unsubVisibility();
			if (drawRef.current) map.removeInteraction(drawRef.current);
			if (selectRef.current) map.removeInteraction(selectRef.current);
			if (modifyRef.current) map.removeInteraction(modifyRef.current);
			if (layerRef.current) map.removeLayer(layerRef.current);
			drawRef.current = null;
			selectRef.current = null;
			modifyRef.current = null;
			layerRef.current = null;
		};
	}, [map, projectPath, selectedHuntId, activePropertyId]);

	const onSubmit = async (values: Record<string, unknown>) => {
		if (!projectPath || !pending) return;
		const { feature } = pending;
		feature.setProperties(values);
		try {
			const activeUser = useUserStore.getState().activeUser;
			if (activeUser) {
				feature.set("created_by", activeUser);
			}
		} catch {
			// ignore
		}
		await persistRef.current();
		setPending(null);
	};

	const onCancel = () => {
		if (pending) {
			sourceRef.current.removeFeature(pending.feature as any);
			void persistRef.current();
		}
		setPending(null);
	};

	return pending ? (
		<div
			style={{
				position: "fixed",
				left: 12,
				right: 12,
				bottom: 12,
				padding: spacing.xl,
				background: colors.bgPanel,
				border: `1px solid ${colors.borderMedium}`,
				borderRadius: borderRadius.xl,
				boxShadow: colors.shadowXLarge,
				zIndex: 2000,
				backdropFilter: "blur(10px)"
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg }}>
				<span style={{ fontSize: 18 }}>🦶</span>
				<div>
					<div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
						Draw Animal Path
					</div>
					<div style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
						Draw a line, then add details.
					</div>
				</div>
			</div>
			<FeatureForm
				layerId="animal_paths"
				initialValues={pending.initial}
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>
		</div>
	) : null;
}

