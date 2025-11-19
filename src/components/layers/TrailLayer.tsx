import { useEffect, useRef, useState } from "react";
import { useMapInstance } from "../../state/map";
import useAppStore from "../../state/store";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Draw, Modify, Select } from "ol/interaction";
import { Stroke, Style, Text as TextStyle, Fill } from "ol/style";
import type { FeatureLike } from "ol/Feature";
import type Feature from "ol/Feature";
import type LineString from "ol/geom/LineString";
import { v4 as uuidv4 } from "uuid";
import { useVisibilityStore } from "../../state/visibility";
import FeatureForm from "../FeatureForm";
import { useUserStore } from "../../state/user";
import { shouldShowFeature, getAgeOpacity } from "../../lib/geo/filters";
import { useSelectionStore } from "../../state/selection";

const trailStyle = (feature?: FeatureLike) => {
	const type = feature?.get?.("trail_type") as string | undefined;
	const condition = feature?.get?.("condition") as string | undefined;
	const baseColor =
		type === "logging_road" ? "#8d6e63" : type === "atv" ? "#a35b20" : "#c57b30";
	const lineDash = condition === "rough" ? [8, 6] : undefined;
	const width = condition === "recent" ? 3.5 : condition === "old" ? 2.5 : 3;
	const labelName = String(feature?.get?.("name") || "");
	const suffix = type === "logging_road" ? " (LR)" : "";
	const a = getAgeOpacity("trails", feature as any);
	const [r, g, b] = baseColor === "#8d6e63" ? [141, 110, 99] : baseColor === "#a35b20" ? [163, 91, 32] : [197, 123, 48];
	return new Style({
		stroke: new Stroke({
			color: `rgba(${r},${g},${b},${a})`,
			width,
			lineDash
		}),
		text:
			labelName
				? new TextStyle({
						text: labelName + suffix,
						font: "12px 'Inter', sans-serif",
						fill: new Fill({ color: `rgba(255,255,255,${a})` }),
						stroke: new Stroke({ color: `rgba(0,0,0,${0.6 * a})`, width: 3 }),
						placement: "line",
						overflow: true
				  })
				: undefined
	});
};

export default function TrailLayer() {
	const { projectPath } = useAppStore();
	const map = useMapInstance();
	const sourceRef = useRef<VectorSource>(new VectorSource());
	const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
	const drawRef = useRef<Draw | null>(null);
	const modifyRef = useRef<Modify | null>(null);
	const selectRef = useRef<Select | null>(null);
	const persistRef = useRef<() => Promise<void>>(async () => {});
	const [pending, setPending] = useState<{
		feature: Feature<LineString>;
		initial: Record<string, unknown>;
	} | null>(null);

	useEffect(() => {
		if (!map || !projectPath) return;

		// Layer setup
		const layer = new VectorLayer({
			source: sourceRef.current,
			style: (feat: FeatureLike) => (shouldShowFeature("trails", feat) ? trailStyle(feat) : null)
		});
		layerRef.current = layer;
		map.addLayer(layer);

		const persist = async () => {
			if (!projectPath) return;
			const gj = new GeoJSON().writeFeaturesObject(sourceRef.current.getFeatures(), {
				dataProjection: "EPSG:4326",
				featureProjection: "EPSG:3857"
			});
			await window.api.writeTextFile(projectPath, "data/trails.geojson", JSON.stringify(gj, null, 2));
		};
		persistRef.current = persist;

		const reload = async () => {
			try {
				const text = await window.api.readTextFile(projectPath, "data/trails.geojson");
				const geojson = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
				const feats = new GeoJSON().readFeatures(geojson, {
					dataProjection: "EPSG:4326",
					featureProjection: "EPSG:3857"
				});
				sourceRef.current.clear();
				sourceRef.current.addFeatures(feats as any);
				let changed = false;
				const features = sourceRef.current.getFeatures() as Feature<LineString>[];
				features.forEach((f, i) => {
					if (!f.get("name")) {
						f.set("name", `Trail ${i + 1}`);
						changed = true;
					}
				});
				if (changed) {
					await persist();
				}
			} catch {
				// ignore
			}
		};
		void reload();
		const onReloadAll = () => void reload();

		// Select + Modify for editing
		const select = new Select({ layers: [layer] as any });
		selectRef.current = select;
		map.addInteraction(select);
		select.on("select", (e) => {
			const f = (e.selected?.[0] as Feature<LineString> | undefined) || null;
			useSelectionStore.getState().setSelected(f ? { layerId: "trails", feature: f } : null);
		});

		const enableModify = () => {
			const activeUser = useUserStore.getState().activeUser;
			if (!activeUser) {
				window.alert("Please select an Active User before editing geometry.");
				return;
			}
			if (modifyRef.current) return;
			const modify = new Modify({ source: sourceRef.current });
			modifyRef.current = modify;
			map.addInteraction(modify);
			modify.on("modifyend", (evt) => {
				const user = useUserStore.getState().activeUser;
				if (!user) return;
				(evt.features as any)?.forEach?.((f: any) => {
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
		window.addEventListener("layer:enable-modify:trails", onEnable);
		window.addEventListener("layer:disable-modify:trails", onDisable);
		window.addEventListener("layer:persist:trails", onPersistEvt);
		select.on("select", () => {
			// selection state drives delete
		});

		const startDraw = () => {
			const activeUser = useUserStore.getState().activeUser;
			if (!activeUser) {
				window.alert("Please select an Active User before adding features.");
				return;
			}
			if (drawRef.current) return;
			const draw = new Draw({ source: sourceRef.current, type: "LineString" });
			drawRef.current = draw;
			map.addInteraction(draw);
			draw.on("drawend", async (evt) => {
				const f = evt.feature as Feature<LineString>;
				(f as any).setId((f as any).getId?.() || uuidv4());
				const count = sourceRef.current.getFeatures().length;
				setPending({
					feature: f,
					initial: {
						name: `Trail ${count}`,
						trail_type: "deer",
						prominence: "main",
						notes: ""
					}
				});
				if (drawRef.current) {
					map.removeInteraction(drawRef.current);
					drawRef.current = null;
				}
			});
		};

		const deleteSelected = async () => {
			const selected = selectRef.current?.getFeatures?.();
			if (selected) {
				selected.forEach((f) => sourceRef.current.removeFeature(f as any));
				selected.clear();
				await persist();
			}
		};

		const onStartDraw = () => startDraw();
		const onDeleteSelected = () => void deleteSelected();
		window.addEventListener("start-trail-draw", onStartDraw);
		window.addEventListener("delete-selected-trail", onDeleteSelected);
		window.addEventListener("layers:reload", onReloadAll);

		return () => {
			window.removeEventListener("layer:enable-modify:trails", onEnable);
			window.removeEventListener("layer:disable-modify:trails", onDisable);
			window.removeEventListener("layer:persist:trails", onPersistEvt);
			window.removeEventListener("start-trail-draw", onStartDraw);
			window.removeEventListener("delete-selected-trail", onDeleteSelected);
			window.removeEventListener("layers:reload", onReloadAll);
			if (drawRef.current) map.removeInteraction(drawRef.current);
			if (modifyRef.current) map.removeInteraction(modifyRef.current);
			if (selectRef.current) map.removeInteraction(selectRef.current);
			if (layerRef.current) map.removeLayer(layerRef.current);
			drawRef.current = null;
			modifyRef.current = null;
			selectRef.current = null;
			layerRef.current = null;
			persistRef.current = async () => {};
		};
	}, [map, projectPath]);

	// Visibility binding
	useEffect(() => {
		const layer = layerRef.current;
		if (!layer) return;
		const apply = () => {
			const visible = useVisibilityStore.getState().isLayerVisible("trails");
			layer.setVisible(visible);
		};
		apply();
		const unsub = useVisibilityStore.subscribe(apply);
		return () => {
			unsub();
		};
	}, []);

	const handleSubmit = async (values: Record<string, unknown>) => {
		if (!pending) return;
		const activeUser = useUserStore.getState().activeUser;
		if (!activeUser) {
			window.alert("Please select an Active User before saving.");
			return;
		}
		pending.feature.setProperties(values);
		if (!pending.feature.get("created_by")) pending.feature.set("created_by", activeUser);
		if (!pending.feature.get("created_at")) pending.feature.set("created_at", new Date().toISOString());
		pending.feature.set("updated_by", activeUser);
		pending.feature.set("updated_at", new Date().toISOString());
		setPending(null);
		await persistRef.current();
	};

	const handleCancel = () => {
		if (pending) {
			sourceRef.current.removeFeature(pending.feature as any);
			setPending(null);
			void persistRef.current();
		}
	};

	return pending ? (
		<div
			style={{
				position: "fixed",
				left: 0,
				right: 0,
				bottom: 0,
				padding: 12,
				background: "rgba(255,255,255,0.95)",
				borderTop: "1px solid #ddd",
				zIndex: 2000
			}}
		>
			<h3 style={{ marginTop: 0 }}>Add Trail</h3>
			<FeatureForm
				layerId="trails"
				initialValues={pending.initial}
				onSubmit={handleSubmit}
				onCancel={handleCancel}
			/>
		</div>
	) : null;
}
