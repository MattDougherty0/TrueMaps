export function propertyScopedGeoJSONPath(
	basePath: string,
	activePropertyId: string | null | undefined
): string {
	// Example:
	// - basePath: "data/trails.geojson" + "camp" => "data/trails_camp.geojson"
	// - basePath: "trees_points.geojson" + "camp" => "trees_points_camp.geojson"
	if (!activePropertyId) return basePath;
	if (!basePath.endsWith(".geojson")) return basePath;
	if (basePath.endsWith(`_${activePropertyId}.geojson`)) return basePath;
	return basePath.replace(/\.geojson$/i, `_${activePropertyId}.geojson`);
}

export function emptyFeatureCollectionString(): string {
	return JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);
}


