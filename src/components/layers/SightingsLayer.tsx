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
import { useHuntSelection } from "../../state/hunts";
import { useUserStore } from "../../state/user";
import { shouldShowFeature, getAgeOpacity } from "../../lib/geo/filters";
import { useSelectionStore } from "../../state/selection";
import { useVisibilityStore } from "../../state/visibility";

const makeSightingStyle = (opacity: number) =>
	new Style({
		image: new CircleStyle({
			radius: 6,
			fill: new Fill({ color: `rgba(236,72,153,${opacity})` }),
			stroke: new Stroke({ color: `rgba(252,231,243,${opacity})`, width: 1.6 })
		})
	});

export default function SightingsLayer() {
	const { projectPath } = useAppStore();
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

		const layer = new VectorLayer({
			source: sourceRef.current,
			style: (feat) => {
				if (!shouldShowFeature("animal_sightings", feat)) return null as any;
				const a = getAgeOpacity("animal_sightings", feat as any);
				return makeSightingStyle(a);
			}
		});
		layerRef.current = layer;
		map.addLayer(layer);

		// Load existing
		const reload = async () => {
			try {
				const text = await window.api.readTextFile(
					projectPath,
					"data/animal_sightings.geojson"
				);
				const geojson = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
				const feats = new GeoJSON().readFeatures(geojson, {
					dataProjection: "EPSG:4326",
					featureProjection: "EPSG:3857"
				});
				sourceRef.current.clear();
				sourceRef.current.addFeatures(feats as any);
			} catch {
				// ignore
			}
		};
		void reload();
		const onReloadAll = () => void reload();

		const startDraw = () => {
			const activeUser = useUserStore.getState().activeUser;
			if (!activeUser) {
				window.alert("Please select an Active User before adding features.");
				return;
			}
			if (drawRef.current) return;
			const draw = new Draw({ source: sourceRef.current, type: "Point" });
			drawRef.current = draw;
			map.addInteraction(draw);
			draw.on("drawend", (evt) => {
				const f = evt.feature as Feature<Point>;
				const initial = {
					sighting_id: uuidv4(),
					hunt_id: selectedHuntId || ""
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
			await window.api.writeTextFile(
				projectPath,
				"data/animal_sightings.geojson",
				JSON.stringify(gj, null, 2)
			);
		};
		persistRef.current = persist;

		const onStartNew = () => startDraw();
		const select = new Select({ layers: [layer] as any });
		selectRef.current = select;
		map.addInteraction(select);
		select.on("select", (e) => {
			const f = (e.selected?.[0] as Feature<Point> | undefined) || null;
			useSelectionStore.getState().setSelected(f ? { layerId: "animal_sightings", feature: f } : null);
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
		window.addEventListener("layer:enable-modify:animal_sightings", onEnable);
		window.addEventListener("layer:disable-modify:animal_sightings", onDisable);
		const onPersistEvt = () => void persist();
		const onDelete = () => {
			const sel = selectRef.current?.getFeatures?.();
			if (sel) {
				sel.forEach((f) => sourceRef.current.removeFeature(f as any));
				sel.clear();
				void persist();
			}
		};
		// already added enable/disable listeners above
		window.addEventListener("layer:persist:animal_sightings", onPersistEvt);
		window.addEventListener("delete-feature-animal_sightings", onDelete);
		window.addEventListener("start-new-sighting", onStartNew);
		window.addEventListener("layers:reload", onReloadAll);

		// Visibility binding
		const updateVisibility = () => {
			if (!layerRef.current) return;
			const visible = useVisibilityStore.getState().isLayerVisible("animal_sightings");
			layerRef.current.setVisible(visible);
		};
		updateVisibility();
		const unsubVisibility = useVisibilityStore.subscribe(updateVisibility);

		return () => {
			window.removeEventListener("start-new-sighting", onStartNew);
			window.removeEventListener("layer:enable-modify:animal_sightings", onEnable);
			window.removeEventListener("layer:disable-modify:animal_sightings", onDisable);
			window.removeEventListener("layer:enable-modify:animal_sightings", onEnable);
			window.removeEventListener("layer:disable-modify:animal_sightings", onDisable);
			window.removeEventListener("layer:persist:animal_sightings", onPersistEvt);
			window.removeEventListener("delete-feature-animal_sightings", onDelete);
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
	}, [map, projectPath, selectedHuntId]);

	const onSubmit = async (values: Record<string, unknown>) => {
		if (!projectPath || !pending) return;
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
			const existing = await window.api.readTextFile(
				projectPath,
				"data/animal_sightings.geojson"
			);
			const parsed = JSON.parse(existing || "{\"type\":\"FeatureCollection\",\"features\":[]}");
			parsed.features.push(gj.features[0]);
			await window.api.writeTextFile(
				projectPath,
				"data/animal_sightings.geojson",
				JSON.stringify(parsed, null, 2)
			);
		} catch {
			await window.api.writeTextFile(
				projectPath,
				"data/animal_sightings.geojson",
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
				left: 0,
				right: 0,
				bottom: 0,
				padding: 12,
				background: "rgba(255,255,255,0.95)",
				borderTop: "1px solid #ddd",
				zIndex: 2000
			}}
		>
			<h3 style={{ marginTop: 0 }}>Add Sighting</h3>
			<FeatureForm
				layerId="animal_sightings"
				initialValues={pending.initial}
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>
		</div>
	) : null;
}


