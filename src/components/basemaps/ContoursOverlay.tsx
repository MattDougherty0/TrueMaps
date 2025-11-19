import { useEffect, useRef } from "react";
import { Stroke, Style } from "ol/style";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import useAppStore from "../../state/store";
import { useMapInstance } from "../../state/map";
import { useBasemapStore } from "../../state/basemaps";

const contourStyle = new Style({
	stroke: new Stroke({
		color: "rgba(120, 120, 120, 0.7)",
		width: 1
	})
});

export default function ContoursOverlay() {
	const map = useMapInstance();
	const { projectPath } = useAppStore();
	const layerRef = useRef<VectorLayer<VectorSource> | null>(null);

	useEffect(() => {
		if (!map || !projectPath) return;
		let cancelled = false;
		const source = new VectorSource();
		const layer = new VectorLayer({
			source,
			style: contourStyle,
			zIndex: 2
		});
		layer.setVisible(useBasemapStore.getState().visible.contours);
		layerRef.current = layer;
		map.addLayer(layer);

		const loadContours = async () => {
			try {
				const text = await window.api.readTextFile(projectPath, "tiles/contours.geojson");
				if (!text || cancelled) return;
				const features = new GeoJSON().readFeatures(text, {
					dataProjection: "EPSG:4326",
					featureProjection: map.getView().getProjection()
				});
				source.clear();
				source.addFeatures(features);
			} catch (err) {
				console.error("Failed to load contours", err);
			}
		};

		void loadContours();

		const unsub = useBasemapStore.subscribe((s) => {
			layer.setVisible(!!s.visible.contours);
		});

		return () => {
			cancelled = true;
			unsub();
			if (layerRef.current) {
				map.removeLayer(layerRef.current);
				layerRef.current = null;
			}
		};
	}, [map, projectPath]);

	return null;
}


