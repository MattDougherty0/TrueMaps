import { useEffect, useRef, useState } from "react";
import { useMapInstance } from "../../state/map";
import useAppStore from "../../state/store";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Draw, Select } from "ol/interaction";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { v4 as uuidv4 } from "uuid";
import type Feature from "ol/Feature";
import type Point from "ol/geom/Point";
import FeatureForm from "../FeatureForm";
import { useVisibilityStore } from "../../state/visibility";
import { useHuntSelection } from "../../state/hunts";
import { useUserStore } from "../../state/user";
import { shouldShowFeature, getAgeOpacity } from "../../lib/geo/filters";
import { useSelectionStore } from "../../state/selection";
import { emptyFeatureCollectionString, propertyScopedGeoJSONPath } from "../../lib/geo/propertyScopedFiles";
import { borderRadius, colors, spacing, typography } from "../../lib/theme";

const makeHarvestStyle = (opacity: number) =>
	new Style({
		image: new CircleStyle({
			radius: 6,
			fill: new Fill({ color: `rgba(211,47,47,${opacity})` }),
			stroke: new Stroke({ color: `rgba(255,255,255,${opacity})`, width: 2 })
		})
	});

export default function HarvestsLayer() {
	const { projectPath, activePropertyId } = useAppStore();
	const map = useMapInstance();
	const sourceRef = useRef<VectorSource>(new VectorSource());
	const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
	const drawRef = useRef<Draw | null>(null);
	const selectRef = useRef<Select | null>(null);
	const modifyRef = useRef<any | null>(null);
	const persistRef = useRef<() => Promise<void>>(async () => {});
	const selectedHuntId = useHuntSelection((s) => s.selectedHuntId);

	const [pending, setPending] = useState<{
		feature: Feature<Point>;
		initial: Record<string, unknown>;
	} | null>(null);

	useEffect(() => {
		if (!map || !projectPath) return;
		const dataPath = propertyScopedGeoJSONPath("data/harvests.geojson", activePropertyId);

		const layer = new VectorLayer({
			source: sourceRef.current,
			style: (feat) => {
				if (!shouldShowFeature("harvests", feat)) return null as any;
				const a = getAgeOpacity("harvests", feat as any);
				return makeHarvestStyle(a);
			}
		});
		layerRef.current = layer;
		map.addLayer(layer);

		// Load existing
		(async () => {
			try {
				const text = await window.api.readTextFile(projectPath, dataPath);
				const geojson = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
				const feats = new GeoJSON().readFeatures(geojson, {
					dataProjection: "EPSG:4326",
					featureProjection: "EPSG:3857"
				});
				sourceRef.current.clear();
				sourceRef.current.addFeatures(feats as any);
			} catch {
				try {
					await window.api.writeTextFile(projectPath, dataPath, emptyFeatureCollectionString());
				} catch {
					// ignore
				}
			}
		})();

		const startDraw = () => {
			if (drawRef.current) return;
			const draw = new Draw({ source: sourceRef.current, type: "Point" });
			drawRef.current = draw;
			map.addInteraction(draw);
			draw.on("drawend", (evt) => {
				const f = evt.feature as Feature<Point>;
				const now = new Date();
				const yyyy = now.getFullYear();
				const mm = String(now.getMonth() + 1).padStart(2, "0");
				const dd = String(now.getDate()).padStart(2, "0");
				const initial: Record<string, unknown> = {
					harvest_id: uuidv4(),
					hunt_id: selectedHuntId || "",
					date: `${yyyy}-${mm}-${dd}`
				};
				setPending({ feature: f, initial });
				if (drawRef.current) {
					map.removeInteraction(drawRef.current);
					drawRef.current = null;
				}
			});
		};

		const persist = async () => {
			if (!projectPath) return;
			const gj = new GeoJSON().writeFeaturesObject(sourceRef.current.getFeatures(), {
				dataProjection: "EPSG:4326",
				featureProjection: "EPSG:3857"
			});
			await window.api.writeTextFile(projectPath, dataPath, JSON.stringify(gj, null, 2));
		};
		persistRef.current = persist;

		const onStartNew = () => startDraw();
		const select = new Select({ layers: [layer] as any });
		selectRef.current = select;
		map.addInteraction(select);
		select.on("select", (e) => {
			const f = (e.selected?.[0] as Feature<Point> | undefined) || null;
			useSelectionStore.getState().setSelected(f ? { layerId: "harvests", feature: f } : null);
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
				void persist();
			});
		};
		const disableModify = () => {
			if (!modifyRef.current) return;
			map.removeInteraction(modifyRef.current);
			modifyRef.current = null;
		};
		const onEnable = () => enableModify();
		const onDisable = () => disableModify();
		const onPersistEvt = () => void persist();
		const onDelete = () => {
			const sel = selectRef.current?.getFeatures?.();
			if (sel) {
				sel.forEach((f) => sourceRef.current.removeFeature(f as any));
				sel.clear();
				void persist();
			}
		};
		window.addEventListener("layer:enable-modify:harvests", onEnable);
		window.addEventListener("layer:disable-modify:harvests", onDisable);
		window.addEventListener("layer:persist:harvests", onPersistEvt);
		window.addEventListener("delete-feature-harvests", onDelete);
		window.addEventListener("start-new-harvest", onStartNew);

		return () => {
			window.removeEventListener("start-new-harvest", onStartNew);
			window.removeEventListener("layer:enable-modify:harvests", onEnable);
			window.removeEventListener("layer:disable-modify:harvests", onDisable);
			window.removeEventListener("layer:persist:harvests", onPersistEvt);
			window.removeEventListener("delete-feature-harvests", onDelete);
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

	// Visibility binding
	useEffect(() => {
		const layer = layerRef.current;
		if (!layer) return;
		const updateVisibility = () => {
			if (!layerRef.current) return;
			const visible = useVisibilityStore.getState().isLayerVisible("harvests");
			layerRef.current.setVisible(visible);
		};
		updateVisibility();
		const unsub = useVisibilityStore.subscribe(updateVisibility);
		return () => {
			unsub();
		};
	}, []);

	const onSubmit = async (values: Record<string, unknown>) => {
		if (!projectPath || !pending) return;
		const dataPath = propertyScopedGeoJSONPath("data/harvests.geojson", activePropertyId);
		const { feature } = pending;
		const activeUser = useUserStore.getState().activeUser;
		if (!activeUser) {
			window.alert("Please select an Active User before saving.");
			return;
		}
		feature.setProperties(values);
		if (!feature.get("created_by")) feature.set("created_by", activeUser);
		if (!feature.get("created_at")) feature.set("created_at", new Date().toISOString());
		feature.set("updated_by", activeUser);
		feature.set("updated_at", new Date().toISOString());
		const gj = new GeoJSON().writeFeaturesObject([feature], {
			dataProjection: "EPSG:4326",
			featureProjection: "EPSG:3857"
		});
		try {
			const existing = await window.api.readTextFile(projectPath, dataPath);
			const parsed = JSON.parse(existing || "{\"type\":\"FeatureCollection\",\"features\":[]}");
			parsed.features.push(gj.features[0]);
			await window.api.writeTextFile(
				projectPath,
				dataPath,
				JSON.stringify(parsed, null, 2)
			);
		} catch {
			await window.api.writeTextFile(
				projectPath,
				dataPath,
				JSON.stringify(gj, null, 2)
			);
		}
		setPending(null);
	};

	const onCancel = () => {
		if (pending) {
			sourceRef.current.removeFeature(pending.feature as any);
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
				<span style={{ fontSize: 18 }}>🏆</span>
				<div>
					<div style={{ fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
						Add Harvest
					</div>
					<div style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
						Drop a point, then add details.
					</div>
				</div>
			</div>
			<FeatureForm layerId="harvests" initialValues={pending.initial} onSubmit={onSubmit} onCancel={onCancel} />
		</div>
	) : null;
}


