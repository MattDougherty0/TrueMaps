export type WaybackRelease = {
	releaseDate: string; // e.g., "2018-05-21"
	releaseNum: number;
};

type WaybackConfigEntry = {
	itemTitle?: string;
	itemURL?: string;
	layerIdentifier?: string;
};

const WAYBACK_CONFIG_URL =
	"https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json";
const WAYBACK_TILE_BASE =
	"https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile";

export const USGS_NAIP_IMAGE_SERVER =
	"https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer";

function releaseDateFromTitle(title: string | undefined): string | null {
	const match = (title || "").match(/(20\d{2}-\d{2}-\d{2})/);
	return match ? match[1] : null;
}

/** All Wayback releases from Esri's official config, newest first. */
export async function fetchAllWaybackReleases(): Promise<WaybackRelease[]> {
	const res = await fetch(WAYBACK_CONFIG_URL);
	if (!res.ok) throw new Error(`Wayback config HTTP ${res.status}`);
	const json = (await res.json()) as Record<string, WaybackConfigEntry>;
	const releases: WaybackRelease[] = [];
	for (const [key, value] of Object.entries(json || {})) {
		const releaseNum = Number(key);
		const releaseDate = releaseDateFromTitle(value?.itemTitle);
		if (!Number.isFinite(releaseNum) || !releaseDate) continue;
		releases.push({ releaseDate, releaseNum });
	}
	releases.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
	return releases;
}

/** Keep the newest release within each calendar year (keeps the picker usable). */
export function pickLatestWaybackReleasePerYear(releases: WaybackRelease[]): WaybackRelease[] {
	const byYear = new Map<number, WaybackRelease>();
	for (const release of releases) {
		const year = Number(release.releaseDate.slice(0, 4));
		if (!Number.isFinite(year) || byYear.has(year)) continue;
		byYear.set(year, release);
	}
	return Array.from(byYear.values()).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
}

/**
 * Load Wayback releases for a location.
 * Uses Esri's official config and keeps the newest release per calendar year
 * so the picker stays usable (~one option per year back to 2014).
 */
export async function fetchWaybackReleasesForLocation(
	_lon: number,
	_lat: number
): Promise<WaybackRelease[]> {
	const all = await fetchAllWaybackReleases();
	return pickLatestWaybackReleasePerYear(all);
}

export function buildWaybackTileUrlTemplate(release: WaybackRelease): string {
	// Official Wayback WMTS/MapServer path embeds releaseNum before z/y/x.
	return `${WAYBACK_TILE_BASE}/${release.releaseNum}/{z}/{y}/{x}`;
}

export async function fetchNaipYearsForLocation(lon: number, lat: number): Promise<number[]> {
	const delta = 0.08;
	const params = new URLSearchParams({
		geometry: `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`,
		geometryType: "esriGeometryEnvelope",
		inSR: "4326",
		spatialRel: "esriSpatialRelIntersects",
		where: "Category = 1",
		outFields: "Year",
		returnGeometry: "false",
		returnDistinctValues: "true",
		orderByFields: "Year",
		f: "json"
	});
	try {
		const res = await fetch(`${USGS_NAIP_IMAGE_SERVER}/query?${params.toString()}`);
		if (!res.ok) return [];
		const json = await res.json();
		const years = (Array.isArray(json?.features) ? json.features : [])
			.map((f: any) => Number(f?.attributes?.Year))
			.filter((y: number) => Number.isFinite(y));
		return Array.from(new Set<number>(years)).sort((a, b) => b - a);
	} catch {
		return [];
	}
}

export function generateNaipYearTemplates(
	years: number[]
): {
	label: string;
	year: number;
	arcgisImageUrl: string;
	mosaicWhere: string;
	type: "arcgis-image";
}[] {
	return years.map((y) => ({
		label: `NAIP ${y}`,
		year: y,
		arcgisImageUrl: USGS_NAIP_IMAGE_SERVER,
		// USGS NAIP is not time-enabled; filter mosaics by catalog Year attribute.
		mosaicWhere: `Year = ${y}`,
		type: "arcgis-image"
	}));
}

/** Curated statewide PA orthos known to cover western/central PA (not county-only layers). */
export function getPaStatewideImageryEntries(): Array<{
	label: string;
	year: number;
	url: string;
	isImageServer: boolean;
}> {
	const base = "https://imagery.pasda.psu.edu/arcgis/rest/services";
	return [
		{
			label: "PEMA Imagery 2018–2020",
			year: 2020,
			url: `${base}/PEMAImagery2018_2020/MapServer`,
			isImageServer: false
		},
		{
			// Non-cache PEMAImagery2021_2023 returns blank tiles unless layers=show:0;
			// the cache service renders correctly with OpenLayers TileArcGISRest defaults.
			label: "PEMA Imagery 2021–2023",
			year: 2023,
			url: `${base}/PEMAImagery2021_2023cache/MapServer`,
			isImageServer: false
		}
	];
}

