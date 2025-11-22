/**
 * Web platform implementation using browser APIs
 * Uses IndexedDB for storage
 */

import { PlatformAPI } from "./index";

const DB_NAME = "huntmaps";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_FILES = "files";
const STORE_MEDIA = "media";

let activeProjectId: string | null = null;

async function getDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
				db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
			}
			if (!db.objectStoreNames.contains(STORE_FILES)) {
				db.createObjectStore(STORE_FILES, { keyPath: "path" });
			}
			if (!db.objectStoreNames.contains(STORE_MEDIA)) {
				db.createObjectStore(STORE_MEDIA, { keyPath: "path" });
			}
		};
	});
}

async function getFileFromDB(projectId: string, relativePath: string): Promise<string | null> {
	try {
		const db = await getDB();
		const store = db.transaction([STORE_FILES], "readonly").objectStore(STORE_FILES);
		const key = `${projectId}/${relativePath}`;
		const request = store.get(key);
		return new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result?.content || null);
			request.onerror = () => reject(request.error);
		});
	} catch {
		return null;
	}
}

async function saveFileToDB(projectId: string, relativePath: string, content: string): Promise<void> {
	const db = await getDB();
	const store = db.transaction([STORE_FILES], "readwrite").objectStore(STORE_FILES);
	const key = `${projectId}/${relativePath}`;
	await new Promise<void>((resolve, reject) => {
		const request = store.put({ path: key, content, projectId, relativePath });
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

export const webAPI: PlatformAPI = {
	async chooseDirectory(): Promise<string | null> {
		// For web, create a new project with a prompt
		// The UI will handle project selection via ProjectSelector component
		const projectName = prompt("Enter project name:");
		if (!projectName) return null;
		const projectId = `proj_${Date.now()}`;
		activeProjectId = projectId;
		
		// Store project metadata in IndexedDB
		const db = await getDB();
		const store = db.transaction([STORE_PROJECTS], "readwrite").objectStore(STORE_PROJECTS);
		await new Promise<void>((resolve, reject) => {
			const request = store.put({ id: projectId, name: projectName });
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
		
		// Add to project list
		const { addLocalProject } = await import("../storage/localProjects");
		addLocalProject({
			id: projectId,
			name: projectName,
			updatedAt: new Date().toISOString()
		});
		
		return projectId;
	},

	async chooseFile(): Promise<string | null> {
		return new Promise((resolve) => {
			const input = document.createElement("input");
			input.type = "file";
			input.onchange = () => {
				resolve(input.files?.[0] ? (input.files[0] as any).path || input.files[0].name : null);
			};
			input.oncancel = () => resolve(null);
			input.click();
		});
	},

	async chooseFiles(): Promise<string[]> {
		return new Promise((resolve) => {
			const input = document.createElement("input");
			input.type = "file";
			input.multiple = true;
			input.onchange = () => {
				resolve(Array.from(input.files || []).map(f => (f as any).path || f.name));
			};
			input.oncancel = () => resolve([]);
			input.click();
		});
	},

	async readTextFile(baseDir: string, relativePath: string): Promise<string> {
		const content = await getFileFromDB(baseDir, relativePath);
		if (content !== null) return content;
		throw new Error(`File not found: ${relativePath}`);
	},

	async writeTextFile(baseDir: string, relativePath: string, content: string): Promise<boolean> {
		await saveFileToDB(baseDir, relativePath, content);
		return true;
	},

	async atomicWriteTextFile(baseDir: string, relativePath: string, content: string): Promise<boolean> {
		return this.writeTextFile(baseDir, relativePath, content);
	},

	async writeBinaryFile(baseDir: string, relativePath: string, base64Data: string): Promise<boolean> {
		const db = await getDB();
		const store = db.transaction([STORE_FILES], "readwrite").objectStore(STORE_FILES);
		const key = `${baseDir}/${relativePath}`;
		const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
		const blob = new Blob([binaryData]);
		await new Promise<void>((resolve, reject) => {
			const request = store.put({ path: key, blob, projectId: baseDir, relativePath });
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
		return true;
	},

	async readExternalFile(): Promise<string> {
		throw new Error("readExternalFile not supported in web mode");
	},

	async copyToMedia(): Promise<string> {
		throw new Error("copyToMedia not fully implemented");
	},

	async resolveMediaPath(baseDir: string, relativePath: string): Promise<string> {
		return `blob:media/${baseDir}/${relativePath}`;
	},

	async deleteFile(): Promise<boolean> {
		return false;
	},

	async projectCreateStructure(baseDir: string, projectName: string): Promise<boolean> {
		const emptyFC = JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);
		const dataFiles = [
			"property_boundary.geojson",
			"trees_points.geojson",
			"tree_stands.geojson",
			"bedding_areas.geojson",
			"beds_points.geojson",
			"open_woods.geojson",
			"cover_points.geojson",
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
			"harvests.geojson",
			"animal_sightings.geojson",
			"animal_paths.geojson",
			"animal_sign.geojson"
		];
		
		for (const file of dataFiles) {
			await saveFileToDB(baseDir, `data/${file}`, emptyFC);
		}
		
		const projectJson = {
			name: projectName,
			crs: { code: "", utmZone: 0, isNorthern: true },
			users: [],
			style: {}
		};
		await saveFileToDB(baseDir, "project.json", JSON.stringify(projectJson, null, 2));
		
		// Create empty contours file
		const emptyContours = JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);
		await saveFileToDB(baseDir, "tiles/contours.geojson", emptyContours);
		
		// Update project in list
		const { updateLocalProject } = await import("../storage/localProjects");
		updateLocalProject(baseDir, { updatedAt: new Date().toISOString() });
		
		return true;
	},

	setActiveProject(baseDir: string): void {
		activeProjectId = baseDir;
	},

	async printPdf(): Promise<string | null> {
		return null;
	},

	async exportGeoPackage(): Promise<string | null> {
		return null;
	}
};

