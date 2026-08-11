import { create } from "zustand";

export type ProjectProperty = {
	id: string;
	name: string;
	/**
	 * Filename in `data/` for the boundary GeoJSON, e.g. "property_boundary.geojson"
	 * or "property_boundary_camp.geojson".
	 */
	boundaryFile: string;
};

type AppState = {
	projectPath: string | null;
	projectName: string | null;
	loading: boolean;
	hasBoundary: boolean;
	pendingView: { lon: number; lat: number; zoom?: number } | null;
	properties: ProjectProperty[];
	activePropertyId: string | null;
	createNewProject: () => Promise<void>;
	openExistingProject: () => Promise<void>;
	setCrsFromLonLat: (lon: number, lat: number) => Promise<void>;
	setHasBoundary: (value: boolean) => void;
	setPendingView: (payload: { lon: number; lat: number; zoom?: number } | null) => void;
	setActivePropertyId: (propertyId: string | null) => Promise<void>;
};

const fileLikePattern = /\.(kml|kmz|geojson|json|gpx)$/i;

const normalizePropertyId = (id: unknown): string | null => {
	if (typeof id !== "string") return null;
	const trimmed = id.trim();
	if (!trimmed) return null;
	return trimmed;
};

const normalizeBoundaryFile = (file: unknown): string | null => {
	if (typeof file !== "string") return null;
	const trimmed = file.trim().replace(/^data\//, "");
	if (!trimmed) return null;
	// Ensure it's a GeoJSON-ish filename
	if (!/\.(geojson|json)$/i.test(trimmed)) return null;
	return trimmed;
};

const normalizeProperties = (raw: unknown): ProjectProperty[] | null => {
	if (!Array.isArray(raw)) return null;
	const out: ProjectProperty[] = [];
	for (const item of raw) {
		const o = item as any;
		const id = normalizePropertyId(o?.id);
		const name = typeof o?.name === "string" && o.name.trim() ? o.name.trim() : null;
		const boundaryFile = normalizeBoundaryFile(o?.boundaryFile);
		if (!id || !name || !boundaryFile) continue;
		out.push({ id, name, boundaryFile });
	}
	return out.length ? out : null;
};

const getActiveBoundaryFile = (state: Pick<AppState, "properties" | "activePropertyId">): string => {
	const activeId = state.activePropertyId;
	if (activeId) {
		const found = state.properties.find((p) => p.id === activeId);
		if (found?.boundaryFile) return found.boundaryFile;
	}
	// Back-compat: single property project uses the legacy file
	return "property_boundary.geojson";
};

const readBoundaryCenter = async (
	projectDir: string,
	boundaryFile: string
): Promise<{ exists: boolean; center: [number, number] | null }> => {
	try {
		const boundaryStr = await window.api.readTextFile(projectDir, `data/${boundaryFile}`);
		if (!boundaryStr) return { exists: false, center: null };
		const boundary = JSON.parse(boundaryStr) as {
			features?: Array<{ geometry?: { type?: string; coordinates?: any } }>;
		};
		const firstGeom = boundary?.features?.[0]?.geometry;
		if (firstGeom?.type !== "Polygon" || !Array.isArray(firstGeom.coordinates)) {
			return { exists: false, center: null };
		}
		const coords = firstGeom.coordinates[0];
		if (!Array.isArray(coords) || coords.length === 0) {
			return { exists: false, center: null };
		}
		const lons = coords.map((c: any) => c?.[0]).filter((v: any) => typeof v === "number");
		const lats = coords.map((c: any) => c?.[1]).filter((v: any) => typeof v === "number");
		if (!lons.length || !lats.length) return { exists: false, center: null };
		const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
		const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
		if (!Number.isFinite(lon) || !Number.isFinite(lat)) return { exists: true, center: null };
		return { exists: true, center: [lon, lat] };
	} catch {
		return { exists: false, center: null };
	}
};

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
	properties: [{ id: "default", name: "Property", boundaryFile: "property_boundary.geojson" }],
	activePropertyId: null,
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
				pendingView: null,
				properties: [{ id: "default", name: "Property", boundaryFile: "property_boundary.geojson" }],
				activePropertyId: "default"
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
			const pj = JSON.parse(pjStr) as { name?: string; properties?: unknown; activePropertyId?: unknown };
			window.api.setActiveProject(projectDir);
			const props =
				normalizeProperties((pj as any)?.properties) ??
				[{ id: "default", name: "Property", boundaryFile: "property_boundary.geojson" }];
			let nextActiveId = normalizePropertyId((pj as any)?.activePropertyId);
			if (nextActiveId && !props.some((p) => p.id === nextActiveId)) {
				nextActiveId = null;
			}
			// If the project has properties but no active selection yet, default to the first property.
			// Users can switch via the Property dropdown in the UI.
			if (!nextActiveId) {
				nextActiveId = props[0]?.id || null;
			}

			// Layers auto-seed missing GeoJSON on first visible load — skip the sequential
			// open-time probe of every data/*.geojson file (was a blocking IPC storm).

			// Seed additional boundary files for multi-property projects in parallel
			try {
				await Promise.all(
					props.map(async (p) => {
						try {
							await window.api.readTextFile(projectDir, `data/${p.boundaryFile}`);
						} catch {
							const emptyFC = JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);
							await window.api.writeTextFile(projectDir, `data/${p.boundaryFile}`, emptyFC);
						}
					})
				);
			} catch {
				// non-fatal
			}

			// Only auto-zoom if we already know which property is active
			const activeBoundaryFile = getActiveBoundaryFile({
				properties: props,
				activePropertyId: nextActiveId
			});
			const { exists: boundaryExists, center: boundaryCenter } = nextActiveId
				? await readBoundaryCenter(projectDir, activeBoundaryFile)
				: { exists: false, center: null };

			set({
				projectPath: projectDir,
				projectName: pj?.name || "Unnamed Project",
				loading: false,
				hasBoundary: boundaryExists,
				pendingView: boundaryCenter ? { lon: boundaryCenter[0], lat: boundaryCenter[1], zoom: 16 } : null,
				properties: props,
				activePropertyId: nextActiveId
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
	,
	setActivePropertyId: async (propertyId: string | null) => {
		const state = (useAppStore.getState?.() as AppState) || null;
		const baseDir = state?.projectPath;
		if (!baseDir) {
			set({ activePropertyId: propertyId, hasBoundary: false, pendingView: null });
			return;
		}
		const nextId = normalizePropertyId(propertyId);
		const valid =
			nextId && (state?.properties || []).some((p) => p.id === nextId) ? nextId : null;
		const boundaryFile = getActiveBoundaryFile({
			properties: state?.properties || [],
			activePropertyId: valid
		});
		const { exists, center } = valid ? await readBoundaryCenter(baseDir, boundaryFile) : { exists: false, center: null };

		set({
			activePropertyId: valid,
			hasBoundary: exists,
			pendingView: center ? { lon: center[0], lat: center[1], zoom: 16 } : null
		});

		// Persist selection to project.json for next launch
		try {
			const pjStr = await window.api.readTextFile(baseDir, "project.json");
			const pj = JSON.parse(pjStr || "{}");
			(pj as any).activePropertyId = valid;
			await window.api.writeTextFile(baseDir, "project.json", JSON.stringify(pj, null, 2));
		} catch {
			// non-fatal
		}
	}
}));

export default useAppStore;


