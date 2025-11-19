import { useEffect, useRef } from "react";
import { useMapInstance } from "../../state/map";
import useAppStore from "../../state/store";
import { useVisibilityStore } from "../../state/visibility";
import { useAnalyticsStore } from "../../state/analytics";
import Heatmap from "ol/layer/Heatmap";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import * as turf from "@turf/turf";

function confidenceWeight(c: string | undefined): number {
	if (c === "observed") return 1.0;
	if (c === "likely") return 0.6;
	return 0.3;
}

export default function PathDensityLayer() {
	const { projectPath } = useAppStore();
	const map = useMapInstance();
	const layerRef = useRef<Heatmap | null>(null);
	const sourceRef = useRef<VectorSource>(new VectorSource());
	const timeWindow = useVisibilityStore((s) => s.timeWindow);
	const show = useAnalyticsStore((s) => s.showPathDensity);

	useEffect(() => {
		if (!map || !projectPath) return;
		const layer = new Heatmap({
			source: sourceRef.current,
			blur: 20,
			radius: 10
		});
		layer.setVisible(show);
		layerRef.current = layer;
		map.addLayer(layer);

		const load = async () => {
			try {
				const [pathsText, huntsText] = await Promise.all([
					window.api.readTextFile(projectPath, "data/animal_paths.geojson"),
					window.api.readTextFile(projectPath, "data/hunts.geojson")
				]);
				const paths = JSON.parse(pathsText || "{\"type\":\"FeatureCollection\",\"features\":[]}");
				const hunts = JSON.parse(huntsText || "{\"type\":\"FeatureCollection\",\"features\":[]}");
				const huntDateById = new Map<string, string>();
				for (const f of hunts.features || []) {
					if (f?.properties?.hunt_id && f?.properties?.date) {
						huntDateById.set(f.properties.hunt_id, f.properties.date);
					}
				}
				const now = new Date();
				const threshold = new Date(
					now.getFullYear() - (timeWindow === "1y" ? 1 : timeWindow === "5y" ? 5 : 500),
					now.getMonth(),
					now.getDate()
				);

				const points: any[] = [];
				for (const f of paths.features || []) {
					const hid = f?.properties?.hunt_id;
					const dateStr = hid ? huntDateById.get(hid || "") : "1970-01-01";
					const d = new Date(dateStr || "1970-01-01");
					if (timeWindow !== "all" && d < threshold) continue;
					if (!f?.geometry || f.geometry.type !== "LineString") continue;
					const line = f as turf.helpers.Feature<turf.helpers.LineString>;
					const lenKm = turf.length(line, { units: "kilometers" });
					const spacingKm = 0.01; // ~10 meters
					const steps = Math.max(1, Math.floor(lenKm / spacingKm));
					const weight = confidenceWeight(f?.properties?.confidence);
					for (let i = 0; i <= steps; i++) {
						const pt = turf.along(line, i * spacingKm, { units: "kilometers" });
						(pt.properties ??= {}).weight = weight;
						points.push(pt);
					}
				}
				const fc = { type: "FeatureCollection", features: points };
				// OpenLayers heatmap uses feature property 'weight' automatically
				const feats = new GeoJSON().readFeatures(fc as any, {
					dataProjection: "EPSG:4326",
					featureProjection: "EPSG:3857"
				});
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

	useEffect(() => {
		if (layerRef.current) layerRef.current.setVisible(show);
	}, [show]);

	return null;
}


