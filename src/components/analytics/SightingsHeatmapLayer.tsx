import { useEffect, useRef } from "react";
import { useMapInstance } from "../../state/map";
import useAppStore from "../../state/store";
import { useVisibilityStore } from "../../state/visibility";
import { useAnalyticsStore } from "../../state/analytics";
import Heatmap from "ol/layer/Heatmap";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import type Feature from "ol/Feature";

function withinWindow(dateStr: string, window: "all" | "1y" | "5y"): boolean {
	if (window === "all") return true;
	const now = new Date();
	const threshold = new Date(
		now.getFullYear() - (window === "1y" ? 1 : 5),
		now.getMonth(),
		now.getDate()
	);
	const d = new Date(dateStr);
	return d >= threshold;
}

export default function SightingsHeatmapLayer() {
	const { projectPath } = useAppStore();
	const map = useMapInstance();
	const layerRef = useRef<Heatmap | null>(null);
	const sourceRef = useRef<VectorSource>(new VectorSource());
	const timeWindow = useVisibilityStore((s) => s.timeWindow);
	const show = useAnalyticsStore((s) => s.showSightingsHeatmap);

	useEffect(() => {
		if (!map || !projectPath) return;
		const layer = new Heatmap({
			source: sourceRef.current,
			blur: 15,
			radius: 12
		});
		layer.setVisible(show);
		layerRef.current = layer;
		map.addLayer(layer);

		const load = async () => {
			try {
				const [sightingsText, huntsText] = await Promise.all([
					window.api.readTextFile(projectPath, "data/animal_sightings.geojson"),
					window.api.readTextFile(projectPath, "data/hunts.geojson")
				]);
				const sightings = JSON.parse(
					sightingsText || "{\"type\":\"FeatureCollection\",\"features\":[]}"
				);
				const hunts = JSON.parse(huntsText || "{\"type\":\"FeatureCollection\",\"features\":[]}");
				const huntDateById = new Map<string, string>();
				for (const f of hunts.features || []) {
					if (f?.properties?.hunt_id && f?.properties?.date) {
						huntDateById.set(f.properties.hunt_id, f.properties.date);
					}
				}
				const filtered = {
					type: "FeatureCollection",
					properties: {},
					features: (sightings.features || []).filter((f: any) => {
						const hid = f?.properties?.hunt_id;
						const date = hid ? huntDateById.get(hid) : null;
						return withinWindow(date || "1970-01-01", timeWindow);
					})
				};
				const feats = new GeoJSON().readFeatures(filtered, {
					dataProjection: "EPSG:4326",
					featureProjection: "EPSG:3857"
				}) as Feature[];
				sourceRef.current.clear();
				sourceRef.current.addFeatures(feats as any);
			} catch {
				// ignore
			}
		};
		void load();

		return () => {
			if (layerRef.current) map.removeLayer(layerRef.current);
			layerRef.current = null;
		};
	}, [map, projectPath, timeWindow]);

	// toggle visibility reactively
	useEffect(() => {
		if (layerRef.current) layerRef.current.setVisible(show);
	}, [show]);

	return null;
}


