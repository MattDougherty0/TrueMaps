import JSZip from "jszip";
import GPX from "ol/format/GPX";
import GeoJSON from "ol/format/GeoJSON";

const DATA_FILES = [
	"property_boundary.geojson",
	"trees_points.geojson",
	"tree_stands.geojson",
	"bedding_areas.geojson",
	"beds_points.geojson",
	"open_woods.geojson",
	"acorn_flats.geojson",
	"mast_check_points.geojson",
	"big_rocks.geojson",
	"cliffs.geojson",
	"ravines.geojson",
	"streams.geojson",
	"trails.geojson",
	"scrapes.geojson",
	"rubs.geojson",
	"stands.geojson",
	"hunts.geojson",
	"animal_sightings.geojson",
	"animal_paths.geojson"
];

export async function exportZipOfGeoJSON(projectPath: string): Promise<string> {
	const zip = new JSZip();
	for (const name of DATA_FILES) {
		try {
			const text = await window.api.readTextFile(projectPath, `data/${name}`);
			zip.file(name, text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
		} catch {
			zip.file(name, "{\"type\":\"FeatureCollection\",\"features\":[]}");
		}
	}
	const base64 = await zip.generateAsync({ type: "base64" });
	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const rel = `exports/true-map_${ts}.zip`;
	await window.api.writeBinaryFile(projectPath, rel, base64);
	return rel;
}

export async function exportGPX(projectPath: string): Promise<string> {
	const format = new GPX();
	const gj = new GeoJSON();
	const layers = ["trails.geojson", "hunts.geojson", "animal_sightings.geojson", "stands.geojson"];
	const features: any[] = [];
	for (const name of layers) {
		try {
			const text = await window.api.readTextFile(projectPath, `data/${name}`);
			const fc = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
			const feats = gj.readFeatures(fc, {
				dataProjection: "EPSG:4326",
				featureProjection: "EPSG:4326"
			});
			features.push(...(feats as any));
		} catch {
			// ignore
		}
	}
	const gpx = format.writeFeatures(features as any, {
		dataProjection: "EPSG:4326",
		featureProjection: "EPSG:4326"
	});
	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const rel = `exports/true-map_${ts}.gpx`;
	await window.api.writeTextFile(projectPath, rel, gpx);
	return rel;
}


