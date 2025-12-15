import { propertyScopedGeoJSONPath } from "../../lib/geo/propertyScopedFiles";

export async function appendToLayer(
	projectDir: string,
	layerFile: string,
	feature: GeoJSON.Feature,
	activePropertyId?: string | null
): Promise<void> {
	const effectiveFile = propertyScopedGeoJSONPath(layerFile, activePropertyId);
	try {
		const text = await window.api.readTextFile(projectDir, `data/${effectiveFile}`);
		const fc = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
		fc.features.push(feature);
		await writeFeatureCollection(projectDir, effectiveFile, fc);
	} catch {
		const fc = { type: "FeatureCollection", features: [feature] };
		await writeFeatureCollection(projectDir, effectiveFile, fc);
	}
}

async function writeFeatureCollection(
	projectDir: string,
	layerFile: string,
	fc: { type: string; features: GeoJSON.Feature[] }
): Promise<void> {
	const serialized = JSON.stringify(fc, null, 2);
	const atomic = (window.api as any).atomicWriteTextFile;
	if (typeof atomic === "function") {
		try {
			await atomic(projectDir, `data/${layerFile}`, serialized);
			return;
		} catch (err) {
			console.warn("atomic write failed, falling back to non-atomic write", err);
		}
	}
	await window.api.writeTextFile(projectDir, `data/${layerFile}`, serialized);
}


