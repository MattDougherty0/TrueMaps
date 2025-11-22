import { useEffect, useRef } from "react";
import useAppStore from "../../state/store";
import { useHistoricalImagery } from "../../state/historical";
import {
	buildWaybackTileUrlTemplate,
	fetchWaybackReleasesForLocation,
	generateNaipYearTemplates,
	discoverPaArcgisImageryCandidates
} from "../../lib/historical/providers";

export default function HistoricalAutoPopulate() {
	const { projectPath, pendingView, hasBoundary } = useAppStore();
	const addEntry = useHistoricalImagery((s) => s.addEntry);
	const entries = useHistoricalImagery((s) => s.entries);
	const setEnabled = useHistoricalImagery((s) => s.setEnabled);
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
						const boundaryStr = await window.api.readTextFile(projectPath, "data/property_boundary.geojson");
						if (boundaryStr) {
							const boundary = JSON.parse(boundaryStr) as any;
							const firstCoords: number[][] | undefined = boundary?.features?.[0]?.geometry?.coordinates?.[0];
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

				// Fetch Wayback releases for location
				const releases = await fetchWaybackReleasesForLocation(lon as number, lat as number);
				for (const r of releases) {
					const url = buildWaybackTileUrlTemplate(r);
					const year = Number((r.releaseDate || "").slice(0, 4));
					if (!Number.isFinite(year)) continue;
					addEntry({
						id: `wayback_${r.releaseDate}`,
						label: `Wayback ${r.releaseDate}`,
						year,
						urlTemplate: url,
						attribution: "Esri Wayback"
					});
				}

				// Add NAIP year templates - only years actually available in USGS service
				// Available years: 2017, 2019, 2021, 2023 (per service query)
				const naipYears = [2017, 2019, 2021, 2023];
				for (const n of generateNaipYearTemplates(naipYears)) {
					addEntry({
						id: `naip_${n.year}`,
						label: n.label,
						year: n.year,
						arcgisImageUrl: n.arcgisImageUrl,
						timeParam: n.timeParam,
						type: n.type,
						attribution: "USGS NAIP"
					});
				}

				// If PA project, try to discover older NAIP years from PASDA/other sources
				const inPA =
					typeof lon === "number" &&
					typeof lat === "number" &&
					lon >= -80.6 &&
					lon <= -74.5 &&
					lat >= 39.6 &&
					lat <= 42.3;
				if (inPA) {
					// Note: USGS NAIP service doesn't have older years (2003-2012, 2013, 2015)
					// These will be discovered via discoverPaArcgisImageryCandidates if available
					// NHAP 1980s (USDA NRCS)
					const nhapYears = [1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989];
					for (const y of nhapYears) {
						addEntry({
							id: `nhap_${y}`,
							label: `NHAP ${y}`,
							year: y,
							arcgisImageUrl:
								"https://nrcsgeoservices.sc.egov.usda.gov/arcgis/rest/services/ortho_imagery/nhap_All/ImageServer",
							timeParam: `${y}-01-01,${y}-12-31`,
							type: "arcgis-image",
							attribution: "USDA NRCS NHAP"
						});
					}
					// Try to discover additional statewide/county services from PASDA/OA
					try {
						// Skip discovery if offline to avoid noisy errors
						if (!window.navigator.onLine) throw new Error("offline");
						const candidates = await discoverPaArcgisImageryCandidates();
						for (const c of candidates) {
							// Skip years we already added via NAIP/NHAP
							if (naipYears.includes(c.year) || (c.year >= 1980 && c.year <= 1989)) continue;
							// Prefer services that likely cover Armstrong County if the name hints it
							const nameLc = c.label.toLowerCase();
							const likelyArmstrong = nameLc.includes("armstrong");
							addEntry({
								id: `pa_arcgis_${c.year}_${c.label.replace(/\W+/g, "_")}`,
								label: likelyArmstrong ? `${c.label} (Armstrong)` : c.label,
								year: c.year,
								type: c.isImageServer ? "arcgis-image" : "arcgis-map",
								arcgisImageUrl: c.isImageServer ? c.url : undefined,
								arcgisMapUrl: !c.isImageServer ? c.url : undefined,
								attribution: "PA Imagery"
							});
						}
					} catch {
						// ignore discovery errors
					}
				}

				// Enable and select latest by year (prefer Wayback)
				const waybackYears = releases
					.map((r) => Number((r.releaseDate || "").slice(0, 4)))
					.filter((v) => Number.isFinite(v)) as number[];
				const latestYear = Math.max(...(waybackYears.length ? waybackYears : [0]), ...naipYears);
				setEnabled(true);
				const latestWayback = releases
					.map((r) => ({ id: `wayback_${r.releaseDate}`, year: Number((r.releaseDate || "").slice(0, 4)) }))
					.filter((r) => r.year === latestYear)[0];
				if (latestWayback) {
					setSelected(latestWayback.id);
				} else {
					setSelected(`naip_${latestYear}`);
				}
			} finally {
				seededRef.current = true;
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectPath]);
	return null;
}


