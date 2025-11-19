import { create } from "zustand";
import { layerConfigById } from "../lib/geo/layerConfig";

type AppState = {
	projectPath: string | null;
	projectName: string | null;
	loading: boolean;
	hasBoundary: boolean;
	pendingView: { lon: number; lat: number; zoom?: number } | null;
	createNewProject: () => Promise<void>;
	openExistingProject: () => Promise<void>;
	setCrsFromLonLat: (lon: number, lat: number) => Promise<void>;
	setHasBoundary: (value: boolean) => void;
	setPendingView: (payload: { lon: number; lat: number; zoom?: number } | null) => void;
};

const fileLikePattern = /\.(kml|kmz|geojson|json|gpx)$/i;

const normalizeSelection = (raw: string) => {
	const normalized = raw.replace(/\\/g, "/");
	if (fileLikePattern.test(normalized)) {
		const idx = normalized.lastIndexOf("/");
		if (idx > 0) {
			return {
				projectDir: normalized.slice(0, idx),
				selectedFile: normalized
			};
		}
	}
	return { projectDir: normalized, selectedFile: null };
};

const useAppStore = create<AppState>((set) => ({
	projectPath: null,
	projectName: null,
	loading: false,
	hasBoundary: false,
	pendingView: null,
	setHasBoundary: (value: boolean) => set({ hasBoundary: value }),
	setPendingView: (payload) => set({ pendingView: payload }),
	createNewProject: async () => {
		set({ loading: true });
		try {
			const selection = await window.api.chooseDirectory();
			if (!selection) {
				set({ loading: false });
				return;
			}
			const { projectDir, selectedFile } = normalizeSelection(selection);
			const defaultName =
				projectDir.split("/").filter(Boolean).pop() || "My True Map";
			const name = defaultName;
			await window.api.projectCreateStructure(projectDir, name);
			window.api.setActiveProject(projectDir);
			if (selectedFile) {
				window.alert(
					`Project folder created at:\n${projectDir}\n\n(You picked a data file: ${selectedFile}. Use "Import Boundary" once the map loads to import it.)`
				);
			}
			set({
				projectPath: projectDir,
				projectName: name,
				loading: false,
				hasBoundary: false,
				pendingView: null
			});
		} catch (err) {
			console.error("create project failed", err);
			window.alert("Could not create the project. Please choose a writable folder.");
			set({ loading: false });
		}
	},
	openExistingProject: async () => {
		set({ loading: true });
		try {
			const selection = await window.api.chooseDirectory();
			if (!selection) {
				set({ loading: false });
				return;
			}
			const { projectDir } = normalizeSelection(selection);
			const pjStr = await window.api.readTextFile(projectDir, "project.json");
			const pj = JSON.parse(pjStr) as { name?: string };
			window.api.setActiveProject(projectDir);
			// Ensure all expected data files exist (older projects may be missing newer layers)
			try {
				for (const cfg of Object.values(layerConfigById)) {
					try {
						await window.api.readTextFile(projectDir, `data/${cfg.file}`);
					} catch (e) {
						// seed empty FeatureCollection
						const emptyFC = JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);
						await window.api.writeTextFile(projectDir, `data/${cfg.file}`, emptyFC);
					}
				}
			} catch {
				// non-fatal; layers will also auto-seed on demand
			}
			let boundaryCenter: [number, number] | null = null;
			let boundaryExists = false;
			try {
				const boundaryStr = await window.api.readTextFile(projectDir, "data/property_boundary.geojson");
				if (boundaryStr) {
					const boundary = JSON.parse(boundaryStr) as {
						features?: Array<{ geometry?: { type?: string; coordinates?: any } }>;
					};
					const firstGeom = boundary?.features?.[0]?.geometry;
					if (firstGeom?.type === "Polygon" && Array.isArray(firstGeom.coordinates)) {
						const coords = firstGeom.coordinates[0];
						if (Array.isArray(coords) && coords.length > 0) {
							boundaryExists = true;
							const lons = coords.map((c) => c[0]);
							const lats = coords.map((c) => c[1]);
							const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
							const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
							if (Number.isFinite(lon) && Number.isFinite(lat)) {
								boundaryCenter = [lon, lat];
							}
						}
					}
				}
			} catch {
				boundaryCenter = null;
				boundaryExists = false;
			}
			set({
				projectPath: projectDir,
				projectName: pj?.name || "Unnamed Project",
				loading: false,
				hasBoundary: boundaryExists,
				pendingView: boundaryCenter
					? { lon: boundaryCenter[0], lat: boundaryCenter[1], zoom: 16 }
					: null
			});
		} catch (err) {
			console.error("open project failed", err);
			window.alert("That folder doesn’t look like a TRUE MAP project yet.");
			set({ loading: false });
		}
	},
	setCrsFromLonLat: async (lon: number, lat: number) => {
		const state = (useAppStore.getState?.() as AppState) || null;
		const baseDir = state?.projectPath;
		if (!baseDir) return;
		const { pickUtmFromLonLat, registerUtmProjection } = await import(
			"../lib/geo/projection"
		);
		const choice = pickUtmFromLonLat(lon, lat);
		registerUtmProjection(choice);
		try {
			const pjStr = await window.api.readTextFile(baseDir, "project.json");
			const pj = JSON.parse(pjStr || "{}");
			pj.crs = {
				code: choice.code,
				utmZone: choice.utmZone,
				isNorthern: choice.isNorthern
			};
			await window.api.writeTextFile(
				baseDir,
				"project.json",
				JSON.stringify(pj, null, 2)
			);
		} catch {
			// swallow for now; boundary flow will re-attempt write on save
		}
	}
}));

export default useAppStore;


