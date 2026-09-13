import { create } from "zustand";

export type MediaClassification =
	| "known_buck"
	| "unknown_buck"
	| "scrub_buck"
	| "doe"
	| "other_animal"
	| "blank";

export type ReviewNeed = "camera" | "identity";

export const REVIEW_NEED_LABELS: Record<ReviewNeed, string> = {
	camera: "camera site",
	identity: "animal / buck ID"
};

export type MediaFile = {
	id: string;
	name: string;
	path: string; // relative to project/media/
	type: "image" | "video";
	notes?: string;
	sha256?: string;
	storedSha256?: string;
	payloadSha256?: string;
	originalName?: string;
	captureTime?: string;
	captureSubsec?: string;
	cameraMake?: string;
	cameraModel?: string;
	width?: number;
	height?: number;
	propertyId?: string;
	areaName?: string;
	cameraSiteId?: string;
	importSessionId?: string;
	capturedAt?: string;
	reviewStatus?: "pending" | "reviewed";
	classification?: MediaClassification;
	knownDeerIds?: string[];
	deerCount?: number;
	travelDirection?: string;
	trashedAt?: string;
	duplicateOfId?: string;
	originalPath?: string;
	sourcePath?: string;
	sourceRelativePath?: string;
	sourceDeletedAt?: string;
	createdAt: string;
	updatedAt: string;
};

export type MediaFolder = {
	id: string;
	name: string;
	path: string; // relative to project/media/
	notes?: string;
	createdAt: string;
	updatedAt: string;
};

export type KnownDeer = {
	id: string;
	name: string;
	notes?: string;
	coverMediaId?: string;
	createdAt: string;
	updatedAt: string;
};

export type CameraImportSession = {
	id: string;
	propertyId: string | null;
	cameraSiteId: string;
	cameraSiteName: string;
	areaName?: string;
	sourceFolder: string;
	importedAt: string;
	fileIds: string[];
	skippedDuplicates: number;
	failedFiles: string[];
};

export type StoredCameraSite = {
	id: string;
	name: string;
	propertyId: string | null;
	areaName: string | null;
	coordinates: [number, number] | null;
};

export const fileNeedsCamera = (file: MediaFile): boolean =>
	!file.trashedAt && !file.cameraSiteId;

export const fileNeedsIdentity = (file: MediaFile): boolean => {
	if (file.trashedAt) return false;
	if (!file.classification) return true;
	return file.classification === "known_buck" && !(file.knownDeerIds || []).length;
};

export const reviewNeeds = (file: MediaFile): ReviewNeed[] => {
	const needs: ReviewNeed[] = [];
	if (fileNeedsCamera(file)) needs.push("camera");
	if (fileNeedsIdentity(file)) needs.push("identity");
	return needs;
};

export const formatReviewNeeds = (file: MediaFile): string =>
	reviewNeeds(file)
		.map((need) => REVIEW_NEED_LABELS[need])
		.join(" · ");

export const fileNeedsReview = (file: MediaFile): boolean => reviewNeeds(file).length > 0;

type MediaState = {
	folders: MediaFolder[];
	files: MediaFile[];
	knownDeer: KnownDeer[];
	importSessions: CameraImportSession[];
	cameraSites: StoredCameraSite[];
	currentFolderPath: string; // empty string = root
	selectedFile: MediaFile | null;
	viewerOpen: boolean;
	// Actions
	setCurrentFolder: (path: string) => void;
	addFolder: (folder: MediaFolder) => void;
	updateFolder: (id: string, updates: Partial<MediaFolder>) => void;
	deleteFolder: (id: string) => void;
	addFile: (file: MediaFile) => void;
	addFiles: (files: MediaFile[]) => void;
	updateFile: (id: string, updates: Partial<MediaFile>) => void;
	updateFiles: (updates: Array<{ id: string; changes: Partial<MediaFile> }>) => void;
	deleteFile: (id: string) => void;
	moveFile: (id: string, newFolderPath: string) => void;
	addKnownDeer: (deer: KnownDeer) => void;
	updateKnownDeer: (id: string, updates: Partial<KnownDeer>) => void;
	addImportSession: (session: CameraImportSession) => void;
	addCameraSite: (site: StoredCameraSite) => void;
	setSelectedFile: (file: MediaFile | null) => void;
	setViewerOpen: (open: boolean) => void;
	loadFromProject: (projectPath: string) => Promise<void>;
	saveToProject: (projectPath: string) => Promise<void>;
};

const METADATA_FILE = "media/metadata.json";
let saveQueue: Promise<void> = Promise.resolve();

export const useMediaStore = create<MediaState>((set, get) => ({
	folders: [],
	files: [],
	knownDeer: [],
	importSessions: [],
	cameraSites: [],
	currentFolderPath: "",
	selectedFile: null,
	viewerOpen: false,
	setCurrentFolder: (path) => set({ currentFolderPath: path }),
	addFolder: (folder) => set((s) => ({ folders: [...s.folders, folder] })),
	updateFolder: (id, updates) =>
		set((s) => ({
			folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f))
		})),
	deleteFolder: (id) =>
		set((s) => ({
			folders: s.folders.filter((f) => f.id !== id),
			files: s.files.filter((f) => !f.path.startsWith(s.folders.find((ff) => ff.id === id)?.path || ""))
		})),
	addFile: (file) => set((s) => ({ files: [...s.files, file] })),
	addFiles: (files) => set((s) => ({ files: [...s.files, ...files] })),
	updateFile: (id, updates) =>
		set((s) => ({
			files: s.files.map((f) => (f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString() } : f))
		})),
	updateFiles: (updates) =>
		set((s) => {
			const byId = new Map(updates.map((update) => [update.id, update.changes]));
			const now = new Date().toISOString();
			return {
				files: s.files.map((file) => {
					const changes = byId.get(file.id);
					return changes ? { ...file, ...changes, updatedAt: now } : file;
				})
			};
		}),
	deleteFile: (id) => set((s) => ({ files: s.files.filter((f) => f.id !== id) })),
	moveFile: (id, newFolderPath) =>
		set((s) => {
			const file = s.files.find((f) => f.id === id);
			if (!file) return s;
			const newPath = newFolderPath ? `${newFolderPath}/${file.name}` : file.name;
			return {
				files: s.files.map((f) => (f.id === id ? { ...f, path: newPath, updatedAt: new Date().toISOString() } : f))
			};
		}),
	addKnownDeer: (deer) => set((s) => ({ knownDeer: [...s.knownDeer, deer] })),
	updateKnownDeer: (id, updates) =>
		set((s) => ({
			knownDeer: s.knownDeer.map((deer) =>
				deer.id === id ? { ...deer, ...updates, updatedAt: new Date().toISOString() } : deer
			)
		})),
	addImportSession: (session) => set((s) => ({ importSessions: [...s.importSessions, session] })),
	addCameraSite: (site) =>
		set((s) => ({
			cameraSites: s.cameraSites.some((existing) => existing.id === site.id)
				? s.cameraSites.map((existing) => (existing.id === site.id ? site : existing))
				: [...s.cameraSites, site]
		})),
	setSelectedFile: (file) => set({ selectedFile: file }),
	setViewerOpen: (open) => set({ viewerOpen: open }),
	loadFromProject: async (projectPath: string) => {
		try {
			const text = await window.api.readTextFile(projectPath, METADATA_FILE);
			const data = JSON.parse(text) as {
				folders?: MediaFolder[];
				files?: MediaFile[];
				knownDeer?: KnownDeer[];
				importSessions?: CameraImportSession[];
				cameraSites?: StoredCameraSite[];
			};
			set({
				folders: data.folders || [],
				files: data.files || [],
				knownDeer: data.knownDeer || [],
				importSessions: data.importSessions || [],
				cameraSites: data.cameraSites || []
			});
		} catch {
			// File doesn't exist yet, start fresh
			set({ folders: [], files: [], knownDeer: [], importSessions: [], cameraSites: [] });
		}
	},
	saveToProject: async (projectPath: string) => {
		const { folders, files, knownDeer, importSessions, cameraSites } = get();
		const data = { version: 3, folders, files, knownDeer, importSessions, cameraSites };
		const content = JSON.stringify(data, null, 2);
		saveQueue = saveQueue
			.catch(() => {
				// Keep later saves running even if an earlier disk write failed.
			})
			.then(async () => {
				if (typeof window.api.atomicWriteTextFile === "function") {
					await window.api.atomicWriteTextFile(projectPath, METADATA_FILE, content);
					return;
				}
				await window.api.writeTextFile(projectPath, METADATA_FILE, content);
			});
		await saveQueue;
	}
}));



