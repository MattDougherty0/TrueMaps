import { useEffect, useRef } from "react";
import useAppStore from "../../state/store";
import { useHistoricalImagery } from "../../state/historical";
import {
	buildWaybackTileUrlTemplate,
	fetchNaipYearsForLocation,
	fetchWaybackReleasesForLocation,
	generateNaipYearTemplates,
	getPaStatewideImageryEntries
} from "../../lib/historical/providers";

export default function HistoricalAutoPopulate() {
	const { projectPath, pendingView, hasBoundary, properties, activePropertyId } = useAppStore();
	const addEntry = useHistoricalImagery((s) => s.addEntry);
	const setSelected = useHistoricalImagery((s) => s.setSelected);
	const seededRef = useRef(false);

	useEffect(() => {
		// Seed once per project open
		if (!projectPath || seededRef.current) return;
		(async () => {
			try {
				let lon = pendingView?.lon;
				let lat = pendingView?.lat;
				// If pendingView not set, try reading boundary center directly
				if ((!Number.isFinite(lon) || !Number.isFinite(lat)) && hasBoundary) {
					try {
						const boundaryFile =
							properties.find((p) => p.id === activePropertyId)?.boundaryFile ||
							"property_boundary.geojson";
						const boundaryStr = await window.api.readTextFile(projectPath, `data/${boundaryFile}`);
						if (boundaryStr) {
							const boundary = JSON.parse(boundaryStr) as any;
							const firstCoords: number[][] | undefined =
								boundary?.features?.[0]?.geometry?.coordinates?.[0];
							if (Array.isArray(firstCoords) && firstCoords.length > 0) {
								const lons = firstCoords.map((c) => c[0]);
								const lats = firstCoords.map((c) => c[1]);
								const cx = (Math.min(...lons) + Math.max(...lons)) / 2;
								const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
								if (Number.isFinite(cx) && Number.isFinite(cy)) {
									lon = cx;
									lat = cy;
								}
							}
						}
					} catch {
						// ignore
					}
				}
				// If still unknown, skip seeding (user can add manually)
				if (!Number.isFinite(lon as number) || !Number.isFinite(lat as number)) return;

				let latestWaybackId: string | null = null;
				try {
					const releases = await fetchWaybackReleasesForLocation(lon as number, lat as number);
					for (const r of releases) {
						const url = buildWaybackTileUrlTemplate(r);
						const year = Number((r.releaseDate || "").slice(0, 4));
						if (!Number.isFinite(year)) continue;
						const id = `wayback_${r.releaseDate}`;
						if (!latestWaybackId) latestWaybackId = id;
						addEntry({
							id,
							label: `Wayback ${r.releaseDate}`,
							year,
							type: "xyz",
							urlTemplate: url,
							attribution: "Esri Wayback"
						});
					}
				} catch (err) {
					console.warn("[historical] Failed to load Esri Wayback releases", err);
				}

				// NAIP: only years that actually exist for this location
				let naipYears: number[] = [];
				try {
					naipYears = await fetchNaipYearsForLocation(lon as number, lat as number);
					for (const n of generateNaipYearTemplates(naipYears)) {
						addEntry({
							id: `naip_${n.year}`,
							label: n.label,
							year: n.year,
							arcgisImageUrl: n.arcgisImageUrl,
							mosaicWhere: n.mosaicWhere,
							type: n.type,
							attribution: "USGS NAIP"
						});
					}
				} catch (err) {
					console.warn("[historical] Failed to load USGS NAIP years", err);
				}

				// PA: only curated statewide PEMA orthos (skip NHAP + county/campus layers)
				const inPA =
					typeof lon === "number" &&
					typeof lat === "number" &&
					lon >= -80.6 &&
					lon <= -74.5 &&
					lat >= 39.6 &&
					lat <= 42.3;
				if (inPA) {
					for (const c of getPaStatewideImageryEntries()) {
						if (naipYears.includes(c.year)) continue;
						addEntry({
							id: `pa_arcgis_${c.year}_${c.label.replace(/\W+/g, "_")}`,
							label: c.label,
							year: c.year,
							type: c.isImageServer ? "arcgis-image" : "arcgis-map",
							arcgisImageUrl: c.isImageServer ? c.url : undefined,
							arcgisMapUrl: !c.isImageServer ? c.url : undefined,
							attribution: "PASDA / PEMA"
						});
					}
				}

				// Seed catalog + preferred selection only — do not auto-enable.
				// Enabling kicks off remote tile fetches on top of topo/hillshade.
				if (latestWaybackId) {
					setSelected(latestWaybackId);
				} else if (naipYears[0]) {
					setSelected(`naip_${naipYears[0]}`);
				}
			} finally {
				seededRef.current = true;
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectPath]);
	return null;
}
