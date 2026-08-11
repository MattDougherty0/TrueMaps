import { propertyScopedGeoJSONPath } from "../geo/propertyScopedFiles";

export type CameraSite = {
	id: string;
	name: string;
	propertyId: string | null;
	areaName: string | null;
	coordinates: [number, number] | null;
};

type CameraFeature = {
	type?: string;
	geometry?: { type?: string; coordinates?: unknown };
	properties?: Record<string, unknown>;
};

type CameraFeatureCollection = {
	type?: string;
	features?: CameraFeature[];
};

const slugify = (value: string): string =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 36) || "camera";

const shortHash = (value: string): string => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
};

const pointCoordinates = (feature: CameraFeature): [number, number] | null => {
	const coordinates = feature.geometry?.coordinates;
	if (
		feature.geometry?.type !== "Point" ||
		!Array.isArray(coordinates) ||
		typeof coordinates[0] !== "number" ||
		typeof coordinates[1] !== "number"
	) {
		return null;
	}
	return [coordinates[0], coordinates[1]];
};

export const cameraSiteId = (
	name: string,
	coordinates: [number, number] | null,
	propertyId: string | null,
	index = 0
): string =>
	`camera_${slugify(name)}_${shortHash(JSON.stringify([propertyId || "default", coordinates || [], index]))}`;

export async function loadCameraSites(
	projectPath: string,
	propertyId: string | null
): Promise<CameraSite[]> {
	let relativePath = propertyScopedGeoJSONPath("data/trail_cameras.geojson", propertyId);
	let text: string;
	try {
		text = await window.api.readTextFile(projectPath, relativePath);
	} catch (error) {
		if (propertyId !== "default") throw error;
		relativePath = "data/trail_cameras.geojson";
		text = await window.api.readTextFile(projectPath, relativePath);
	}
	const collection = JSON.parse(text) as CameraFeatureCollection;
	const features = Array.isArray(collection.features) ? collection.features : [];
	let changed = false;

	const sites = features
		.map((feature, index): CameraSite => {
			const properties = feature.properties || (feature.properties = {});
			const name =
				typeof properties.name === "string" && properties.name.trim()
					? properties.name.trim()
					: `Camera ${index + 1}`;
			const coordinates = pointCoordinates(feature);
			let id =
				typeof properties.camera_site_id === "string" && properties.camera_site_id.trim()
					? properties.camera_site_id.trim()
					: "";
			if (!id) {
				id = cameraSiteId(name, coordinates, propertyId, index);
				properties.camera_site_id = id;
				changed = true;
			}
			const areaName =
				typeof properties.area_name === "string" && properties.area_name.trim()
					? properties.area_name.trim()
					: null;
			return { id, name, propertyId, areaName, coordinates };
		})
		.sort((a, b) => a.name.localeCompare(b.name));

	if (changed) {
		const content = JSON.stringify({ ...collection, type: "FeatureCollection", features }, null, 2);
		if (typeof window.api.atomicWriteTextFile === "function") {
			await window.api.atomicWriteTextFile(projectPath, relativePath, content);
		} else {
			await window.api.writeTextFile(projectPath, relativePath, content);
		}
		window.dispatchEvent(new Event("layer:reload:trail_cameras"));
	}

	return sites;
}

export async function updateCameraSiteArea(
	projectPath: string,
	propertyId: string | null,
	siteId: string,
	areaName: string
): Promise<void> {
	let relativePath = propertyScopedGeoJSONPath("data/trail_cameras.geojson", propertyId);
	let text: string;
	try {
		text = await window.api.readTextFile(projectPath, relativePath);
	} catch (error) {
		if (propertyId !== "default") throw error;
		relativePath = "data/trail_cameras.geojson";
		text = await window.api.readTextFile(projectPath, relativePath);
	}
	const collection = JSON.parse(text) as CameraFeatureCollection;
	const features = Array.isArray(collection.features) ? collection.features : [];
	const feature = features.find((item) => item.properties?.camera_site_id === siteId);
	if (!feature) throw new Error("Camera site not found");
	feature.properties = feature.properties || {};
	feature.properties.area_name = areaName.trim();
	const content = JSON.stringify({ ...collection, type: "FeatureCollection", features }, null, 2);
	if (typeof window.api.atomicWriteTextFile === "function") {
		await window.api.atomicWriteTextFile(projectPath, relativePath, content);
	} else {
		await window.api.writeTextFile(projectPath, relativePath, content);
	}
	window.dispatchEvent(new Event("layer:reload:trail_cameras"));
}
