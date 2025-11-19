import { useEffect, useRef, useState } from "react";
import { useMapInstance } from "../../state/map";
import useAppStore from "../../state/store";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import { Draw } from "ol/interaction";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { v4 as uuidv4 } from "uuid";
import type Feature from "ol/Feature";
import type Point from "ol/geom/Point";
import FeatureForm from "../FeatureForm";
import { Select } from "ol/interaction";
import { useHuntSelection } from "../../state/hunts";
import { toLonLat } from "ol/proj";
import { useUserStore } from "../../state/user";
import { shouldShowFeature, getAgeOpacity } from "../../lib/geo/filters";
import { useSelectionStore } from "../../state/selection";

const makeHuntStyle = (opacity: number) =>
	new Style({
		image: new CircleStyle({
			radius: 7,
			fill: new Fill({ color: `rgba(14,165,233,${opacity})` }),
			stroke: new Stroke({ color: `rgba(186,230,253,${opacity})`, width: 2 })
		})
	});

export default function HuntsLayer() {
	const { projectPath } = useAppStore();
	const map = useMapInstance();
	const sourceRef = useRef<VectorSource>(new VectorSource());
	const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
	const drawRef = useRef<Draw | null>(null);
	const selectRef = useRef<Select | null>(null);
	const modifyRef = useRef<any | null>(null);
	const setSelectedHuntId = useHuntSelection((s) => s.setSelectedHuntId);
	const persistRef = useRef<() => Promise<void>>(async () => {});

	const [pendingProps, setPendingProps] = useState<{
		feature: Feature<Point>;
		initial: Record<string, unknown>;
	} | null>(null);

	useEffect(() => {
		if (!map || !projectPath) return;

		const layer = new VectorLayer({
			source: sourceRef.current,
			style: (feat) => {
				if (!shouldShowFeature("hunts", feat)) return null as any;
				const a = getAgeOpacity("hunts", feat as any);
				return makeHuntStyle(a);
			}
		});
		layerRef.current = layer;
		map.addLayer(layer);

		// Load existing
		const reload = async () => {
			try {
				const text = await window.api.readTextFile(projectPath, "data/hunts.geojson");
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

		const persist = async () => {
			if (!projectPath) return;
			const gj = new GeoJSON().writeFeaturesObject(sourceRef.current.getFeatures(), {
				dataProjection: "EPSG:4326",
				featureProjection: "EPSG:3857"
			});
			await window.api.writeTextFile(projectPath, "data/hunts.geojson", JSON.stringify(gj, null, 2));
		};
		persistRef.current = persist;

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
			draw.on("drawend", async (evt) => {
				const f = evt.feature as Feature<Point>;
				const now = new Date();
				const yyyy = now.getFullYear();
				const mm = String(now.getMonth() + 1).padStart(2, "0");
				const dd = String(now.getDate()).padStart(2, "0");
				const hh = String(now.getHours()).padStart(2, "0");
				const min = String(now.getMinutes()).padStart(2, "0");
				const initial: Record<string, unknown> = {
					hunt_id: uuidv4(),
					date: `${yyyy}-${mm}-${dd}`,
					start_time: `${hh}:${min}`
				};
				try {
					if (navigator.onLine) {
						const coord = f.getGeometry()?.getCoordinates();
						if (coord) {
							const [lon, lat] = toLonLat(coord);
							const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,pressure_msl&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
							const res = await fetch(url);
							const data = await res.json();
							const cur = data?.current;
							if (cur) {
								if (typeof cur.temperature_2m === "number") initial.temp_f = cur.temperature_2m;
								if (typeof cur.wind_speed_10m === "number") initial.wind_speed_mph = cur.wind_speed_10m;
								if (typeof cur.wind_direction_10m === "number") initial.wind_dir_deg = cur.wind_direction_10m;
								if (typeof cur.pressure_msl === "number") {
									// hPa to inHg
									initial.pressure_inhg = Number((cur.pressure_msl / 33.8638866667).toFixed(2));
								}
							}
						}
					}
				} catch {
					// ignore network errors; fields remain optional
				}
				setPendingProps({ feature: f, initial });
				// keep the point visible while we fill properties
				if (drawRef.current) {
					map.removeInteraction(drawRef.current);
					drawRef.current = null;
				}
			});
		};

		const onStartNew = () => startDraw();
		window.addEventListener("start-new-hunt", onStartNew);

		// selection for linking sightings/paths
		const select = new Select({ layers: [layer] as any });
		selectRef.current = select;
		map.addInteraction(select);
		select.on("select", (e) => {
			const f = e.selected[0] as Feature<Point> | undefined;
			const id = f?.get("hunt_id") || null;
			setSelectedHuntId(id);
			useSelectionStore.getState().setSelected(f ? { layerId: "hunts", feature: f } : null);
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
		window.addEventListener("layer:enable-modify:hunts", onEnable);
		window.addEventListener("layer:disable-modify:hunts", onDisable);
		window.addEventListener("layer:persist:hunts", onPersistEvt);
		window.addEventListener("delete-feature-hunts", onDelete);
		window.addEventListener("layers:reload", onReloadAll);

		return () => {
			window.removeEventListener("start-new-hunt", onStartNew);
			window.removeEventListener("layer:enable-modify:hunts", onEnable);
			window.removeEventListener("layer:disable-modify:hunts", onDisable);
			window.removeEventListener("layer:persist:hunts", onPersistEvt);
			window.removeEventListener("delete-feature-hunts", onDelete);
			window.removeEventListener("layers:reload", onReloadAll);
			if (drawRef.current) map.removeInteraction(drawRef.current);
			if (selectRef.current) map.removeInteraction(selectRef.current);
			if (modifyRef.current) map.removeInteraction(modifyRef.current);
			if (layerRef.current) map.removeLayer(layerRef.current);
			drawRef.current = null;
			selectRef.current = null;
			modifyRef.current = null;
			layerRef.current = null;
		};
	}, [map, projectPath]);

	const onSubmit = async (values: Record<string, unknown>) => {
		if (!projectPath || !pendingProps) return;
		const { feature } = pendingProps;
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
		// Append to existing file
		try {
			const existing = await window.api.readTextFile(projectPath, "data/hunts.geojson");
			const parsed = JSON.parse(existing || "{\"type\":\"FeatureCollection\",\"features\":[]}");
			parsed.features.push(gj.features[0]);
			await window.api.writeTextFile(
				projectPath,
				"data/hunts.geojson",
				JSON.stringify(parsed, null, 2)
			);
		} catch {
			await window.api.writeTextFile(
				projectPath,
				"data/hunts.geojson",
				JSON.stringify(gj, null, 2)
			);
		}
		setPendingProps(null);
	};

	const onCancel = () => {
		// remove the last feature if it has no properties
		if (pendingProps) {
			sourceRef.current.removeFeature(pendingProps.feature as any);
		}
		setPendingProps(null);
	};

	return pendingProps ? (
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
			<h3 style={{ marginTop: 0 }}>New Hunt</h3>
			<FeatureForm
				layerId="hunts"
				initialValues={pendingProps.initial}
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>
		</div>
	) : null;
}


