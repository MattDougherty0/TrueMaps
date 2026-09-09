import { emptyFeatureCollectionString, propertyScopedGeoJSONPath } from "../geo/propertyScopedFiles";

export type CameraSite = {
	id: string;
	name: string;
	propertyId: string | null;
	areaName: string | null;
	coordinates: [number, number] | null;
};

type CameraFeature = {
	type?: string;
	geometry?: { type?: string; coordinates?: unknown } | null;
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

const writeCameraCollection = async (
	projectPath: string,
	relativePath: string,
	collection: CameraFeatureCollection,
	features: CameraFeature[]
): Promise<void> => {
	const content = JSON.stringify({ ...collection, type: "FeatureCollection", features }, null, 2);
	if (typeof window.api.atomicWriteTextFile === "function") {
		await window.api.atomicWriteTextFile(projectPath, relativePath, content);
	} else {
		await window.api.writeTextFile(projectPath, relativePath, content);
	}
	window.dispatchEvent(new Event("layer:reload:trail_cameras"));
};

const parseCollection = (text: string): { collection: CameraFeatureCollection; features: CameraFeature[] } => {
	const collection = JSON.parse(text) as CameraFeatureCollection;
	const features = Array.isArray(collection.features) ? collection.features : [];
	return { collection, features };
};

const resolveCameraSitesFile = async (
	projectPath: string,
	propertyId: string | null
): Promise<{ relativePath: string; collection: CameraFeatureCollection; features: CameraFeature[] }> => {
	const scopedPath = propertyScopedGeoJSONPath("data/trail_cameras.geojson", propertyId);
	try {
		const text = await window.api.readTextFile(projectPath, scopedPath);
		const parsed = parseCollection(text);
		return { relativePath: scopedPath, ...parsed };
	} catch {
		if (!propertyId || propertyId === "default") {
			try {
				const text = await window.api.readTextFile(projectPath, "data/trail_cameras.geojson");
				const parsed = parseCollection(text);
				return { relativePath: "data/trail_cameras.geojson", ...parsed };
			} catch {
				// Fall through and seed an empty collection at the scoped path.
			}
		}
		return {
			relativePath: scopedPath,
			collection: JSON.parse(emptyFeatureCollectionString()) as CameraFeatureCollection,
			features: []
		};
	}
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
	const { relativePath, collection, features } = await resolveCameraSitesFile(projectPath, propertyId);
	if (!features.length && relativePath) {
		return [];
	}
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
		await writeCameraCollection(projectPath, relativePath, collection, features);
	}

	return sites;
}

export async function createCameraSite(
	projectPath: string,
	input: {
		name: string;
		propertyId: string | null;
		areaName: string | null;
		coordinates?: [number, number] | null;
	}
): Promise<CameraSite> {
	const name = input.name.trim();
	if (!name) throw new Error("Camera site name is required");
	const { relativePath, collection, features } = await resolveCameraSitesFile(projectPath, input.propertyId);
	const coordinates = input.coordinates || null;
	const id = cameraSiteId(name, coordinates, input.propertyId, Date.now());
	const now = new Date().toISOString();
	const site: CameraSite = {
		id,
		name,
		propertyId: input.propertyId,
		areaName: input.areaName?.trim() || null,
		coordinates
	};

	if (coordinates) {
		features.push({
			type: "Feature",
			geometry: { type: "Point", coordinates },
			properties: {
				name,
				camera_site_id: id,
				area_name: site.areaName,
				camera_type: "trail",
				created_at: now
			}
		});
		await writeCameraCollection(projectPath, relativePath, collection, features);
	}

	return site;
}

export async function updateCameraSiteArea(
	projectPath: string,
	propertyId: string | null,
	siteId: string,
	areaName: string
): Promise<void> {
	const { relativePath, collection, features } = await resolveCameraSitesFile(projectPath, propertyId);
	const feature = features.find((item) => item.properties?.camera_site_id === siteId);
	if (!feature) throw new Error("Camera site not found");
	feature.properties = feature.properties || {};
	feature.properties.area_name = areaName.trim();
	await writeCameraCollection(projectPath, relativePath, collection, features);
}
