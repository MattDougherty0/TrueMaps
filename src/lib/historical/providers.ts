type WaybackRelease = {
	releaseDate: string; // e.g., "2018-05-21"
	releaseId?: string | number;
};

export async function fetchWaybackReleasesForLocation(
	lon: number,
	lat: number
): Promise<WaybackRelease[]> {
	// Esri Wayback API commonly supports a simple location query; attempt the common variants.
	const candidates = [
		`https://wayback-api.arcgis.com/wayback?location=${lon},${lat}`,
		`https://wayback-api.arcgis.com/wayback?lon=${lon}&lat=${lat}`
	];
	for (const url of candidates) {
		try {
			const res = await fetch(url);
			if (!res.ok) continue;
			const json = await res.json();
			// Normalize a few likely shapes
			const releases: WaybackRelease[] =
				Array.isArray(json?.releases)
					? json.releases
					: Array.isArray(json)
					? json
					: [];
			const parsed = releases
				.map((r: any) => ({
					releaseDate: (r.releaseDate || r.release_date || r.date || "").slice(0, 10),
					releaseId: r.releaseId || r.release_id || r.id
				}))
				.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.releaseDate));
			if (parsed.length > 0) return parsed;
		} catch {
			// try next
		}
	}
	// Fallback: a small curated set of known global release dates
	return [
		{ releaseDate: "2014-08-26" },
		{ releaseDate: "2016-02-05" },
		{ releaseDate: "2018-05-21" },
		{ releaseDate: "2020-06-01" },
		{ releaseDate: "2022-08-01" }
	];
}

export function buildWaybackTileUrlTemplate(release: WaybackRelease): string {
	// Prefer date-based parameter; many deployments accept ?release=YYYY-MM-DD
	if (release.releaseDate) {
		return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?release=${release.releaseDate}`;
	}
	// Fallback to ID-based if available
	if (release.releaseId !== undefined) {
		return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?releaseID=${release.releaseId}`;
	}
	// Last resort: return latest without pinning
	return `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
}

export function generateNaipYearTemplates(
	years: number[]
): { label: string; year: number; arcgisImageUrl: string; timeParam: string; type: "arcgis-image" }[] {
	return years.map((y) => ({
		label: `NAIP ${y}`,
		year: y,
		// Use USGS NAIP service (USDA service at naip-usda.arcgis.com is not resolving)
		arcgisImageUrl: "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer",
		// Time extent for NAIP year; many deployments accept ISO date range.
		timeParam: `${y}-01-01,${y}-12-31`,
		type: "arcgis-image"
	}));
}

type ArcgisServiceList = {
	folders?: string[];
	services?: Array<{ name: string; type: "MapServer" | "ImageServer" | string }>;
};

async function listArcgisServices(baseUrl: string): Promise<Array<{ name: string; type: string }>> {
	try {
		const url = `${baseUrl.replace(/\/+$/, "")}?f=json`;
		const res = await fetch(url);
		if (!res.ok) return [];
		const json = (await res.json()) as ArcgisServiceList;
		const services = Array.isArray(json?.services) ? json.services : [];
		return services.map((s) => ({ name: s.name, type: s.type }));
	} catch {
		return [];
	}
}

export async function discoverPaArcgisImageryCandidates(): Promise<
	Array<{ label: string; year: number; url: string; isImageServer: boolean }>
> {
	// Explore common PA hosts
	const hosts = [
		"https://imagery.nationalmap.gov/arcgis/rest/services", // USGS NAIP (already handled, but safe)
		"https://nrcsgeoservices.sc.egov.usda.gov/arcgis/rest/services", // NHAP (already handled)
		"https://imagery.pasda.psu.edu/arcgis/rest/services"
		// OA host often blocks/changes; avoid by default:
		// "https://arcgisserver.oa.pa.gov/arcgis/rest/services"
	];
	const patterns = [/imagery/i, /ortho/i, /pamap/i, /naip/i, /doq/i];
	const results: Array<{ label: string; year: number; url: string; isImageServer: boolean }> = [];
	for (const host of hosts) {
		const services = await listArcgisServices(host);
		for (const svc of services) {
			if (!patterns.some((p) => p.test(svc.name))) continue;
			// Try to extract a 4-digit year from the service name
			const match = svc.name.match(/(19|20)\d{2}/);
			const year = match ? Number(match[0]) : NaN;
			if (!Number.isFinite(year)) continue;
			const url = `${host.replace(/\/+$/, "")}/${svc.name}/${svc.type}`;
			results.push({
				label: `${svc.name.split("/").pop() || svc.name}`,
				year,
				url,
				isImageServer: /ImageServer$/i.test(url)
			});
		}
	}
	return results;
}


