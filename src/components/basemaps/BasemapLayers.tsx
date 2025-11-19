import { useEffect, useRef } from "react";
import { useMapInstance } from "../../state/map";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import XYZ from "ol/source/XYZ";
import TileArcGISRest from "ol/source/TileArcGISRest";
import ImageArcGISRest from "ol/source/ImageArcGISRest";
import { mbtilesUrl } from "../../lib/mbtiles/client";
import { useBasemapStore } from "../../state/basemaps";
import useAppStore from "../../state/store";
import { useHistoricalImagery } from "../../state/historical";

const REMOTE_SOURCES = {
	topo: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}",
	aerial:
		"https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"
};

export default function BasemapLayers() {
	const map = useMapInstance();
	const { projectPath } = useAppStore();
	const topoRef = useRef<TileLayer<XYZ> | null>(null);
	const aerialRef = useRef<TileLayer<XYZ> | null>(null);
	const hillshadeRef = useRef<TileLayer<XYZ> | null>(null);
	const slopeRef = useRef<TileLayer<XYZ> | null>(null);
	const historicalTileRef = useRef<TileLayer<any> | null>(null);
	const historicalImageRef = useRef<ImageLayer<any> | null>(null);

	useEffect(() => {
		if (!map) return;
		const topoSource = new XYZ({
			url: REMOTE_SOURCES.topo,
			attributions: "USGS Topo"
		});
		topoSource.set("olcs_skip", true);
		const topo = new TileLayer({
			source: topoSource,
			zIndex: 0
		});
		topo.set("basemapKey", "topo");
		const aerialSource = new XYZ({
			url: REMOTE_SOURCES.aerial,
			attributions: "USGS Imagery"
		});
		aerialSource.set("olcs_skip", true);
		const aerial = new TileLayer({
			source: aerialSource,
			zIndex: 0
		});
		aerial.set("basemapKey", "aerial");
		// Only attach local MBTiles-backed layers once a project is active to avoid startup errors
		const hillshade =
			projectPath
				? (() => {
						const source = new XYZ({ url: mbtilesUrl("hillshade") });
						source.set("olcs_skip", true);
						const layer = new TileLayer({
							source,
							zIndex: 1
						});
						layer.set("basemapKey", "hillshade");
						return layer;
				  })()
				: null;
		const slope =
			projectPath
				? (() => {
						const source = new XYZ({ url: mbtilesUrl("slope") });
						source.set("olcs_skip", true);
						const layer = new TileLayer({
							source,
							zIndex: 1
						});
						layer.set("basemapKey", "slope");
						return layer;
				  })()
				: null;
		topoRef.current = topo;
		aerialRef.current = aerial;
		hillshadeRef.current = hillshade as TileLayer<XYZ> | null;
		slopeRef.current = slope as TileLayer<XYZ> | null;
		// Order matters: base imagery then overlays
		map.addLayer(topo);
		map.addLayer(aerial);
		if (hillshade) map.addLayer(hillshade);
		if (slope) map.addLayer(slope);
		// Historical imagery layers (managed by store) - separate tile and image layers
		const histTile = new TileLayer({ visible: false, zIndex: 0 });
		const histImage = new ImageLayer({ visible: false, zIndex: 0 });
		historicalTileRef.current = histTile;
		historicalImageRef.current = histImage;
		map.addLayer(histTile);
		map.addLayer(histImage);

		// initial visibility
		const vis = useBasemapStore.getState().visible;
		topo.setVisible(!!vis.topo);
		aerial.setVisible(!!vis.aerial);
		if (hillshade) hillshade.setVisible(!!vis.hillshade);
		if (slope) slope.setVisible(!!vis.slope);

		const unsub = useBasemapStore.subscribe((s) => {
			topo.setVisible(!!s.visible.topo);
			aerial.setVisible(!!s.visible.aerial);
			if (hillshadeRef.current) hillshadeRef.current.setVisible(!!s.visible.hillshade);
			if (slopeRef.current) slopeRef.current.setVisible(!!s.visible.slope);
		});
		const unsubHistorical = useHistoricalImagery.subscribe((s) => {
			const tileLayer = historicalTileRef.current;
			const imageLayer = historicalImageRef.current;
			if (!tileLayer || !imageLayer) return;
			if (!s.enabled || !s.selectedId) {
				tileLayer.setVisible(false);
				imageLayer.setVisible(false);
				return;
			}
			const entry = s.entries.find((e) => e.id === s.selectedId) || null;
			if (!entry) {
				tileLayer.setVisible(false);
				imageLayer.setVisible(false);
				return;
			}
			// Reset both visibility
			tileLayer.setVisible(false);
			imageLayer.setVisible(false);
			// XYZ
			if (entry.type === "xyz" && entry.urlTemplate) {
				const src = new XYZ({
					url: entry.urlTemplate,
					attributions: entry.attribution || "Historical Imagery",
					crossOrigin: "anonymous"
				});
				src.set("olcs_skip", true);
				tileLayer.setSource(src as any);
				tileLayer.setVisible(true);
				return;
			}
			// ArcGIS MapServer (tiled)
			if (entry.type === "arcgis-map" && entry.arcgisMapUrl) {
				const src = new TileArcGISRest({
					url: entry.arcgisMapUrl,
					attributions: entry.attribution || "Historical Imagery",
					crossOrigin: "anonymous"
				});
				src.set("olcs_skip", true);
				tileLayer.setSource(src as any);
				tileLayer.setVisible(true);
				return;
			}
			// ArcGIS ImageServer (exportImage)
			if ((entry.type === "arcgis-image" || entry.arcgisImageUrl) && entry.arcgisImageUrl) {
				const params = entry.timeParam ? { TIME: entry.timeParam } : undefined;
				const src = new ImageArcGISRest({
					url: entry.arcgisImageUrl,
					params,
					attributions: entry.attribution || "Historical Imagery",
					crossOrigin: "anonymous"
				});
				src.set("olcs_skip", true);
				imageLayer.setSource(src as any);
				imageLayer.setVisible(true);
				return;
			}
		});

		return () => {
			unsub();
			unsubHistorical();
			if (topoRef.current) map.removeLayer(topoRef.current);
			if (aerialRef.current) map.removeLayer(aerialRef.current);
			if (hillshadeRef.current) map.removeLayer(hillshadeRef.current);
			if (slopeRef.current) map.removeLayer(slopeRef.current);
			if (historicalTileRef.current) map.removeLayer(historicalTileRef.current);
			if (historicalImageRef.current) map.removeLayer(historicalImageRef.current);
			topoRef.current = null;
			aerialRef.current = null;
			hillshadeRef.current = null;
			slopeRef.current = null;
			historicalTileRef.current = null;
			historicalImageRef.current = null;
		};
	}, [map, projectPath]);

	return null;
}

