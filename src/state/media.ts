import { create } from "zustand";

export type MediaFile = {
	id: string;
	name: string;
	path: string; // relative to project/media/
	type: "image" | "video";
	notes?: string;
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

type MediaState = {
	folders: MediaFolder[];
	files: MediaFile[];
	currentFolderPath: string; // empty string = root
	selectedFile: MediaFile | null;
	viewerOpen: boolean;
	// Actions
	setCurrentFolder: (path: string) => void;
	addFolder: (folder: MediaFolder) => void;
	updateFolder: (id: string, updates: Partial<MediaFolder>) => void;
	deleteFolder: (id: string) => void;
	addFile: (file: MediaFile) => void;
	updateFile: (id: string, updates: Partial<MediaFile>) => void;
	deleteFile: (id: string) => void;
	moveFile: (id: string, newFolderPath: string) => void;
	setSelectedFile: (file: MediaFile | null) => void;
	setViewerOpen: (open: boolean) => void;
	loadFromProject: (projectPath: string) => Promise<void>;
	saveToProject: (projectPath: string) => Promise<void>;
};

const METADATA_FILE = "media/metadata.json";

export const useMediaStore = create<MediaState>((set, get) => ({
	folders: [],
	files: [],
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
	updateFile: (id, updates) =>
		set((s) => ({
			files: s.files.map((f) => (f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString() } : f))
		})),
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
	setSelectedFile: (file) => set({ selectedFile: file }),
	setViewerOpen: (open) => set({ viewerOpen: open }),
	loadFromProject: async (projectPath: string) => {
		try {
			const text = await window.api.readTextFile(projectPath, METADATA_FILE);
			const data = JSON.parse(text) as { folders?: MediaFolder[]; files?: MediaFile[] };
			set({ folders: data.folders || [], files: data.files || [] });
		} catch {
			// File doesn't exist yet, start fresh
			set({ folders: [], files: [] });
		}
	},
	saveToProject: async (projectPath: string) => {
		const { folders, files } = get();
		const data = { folders, files };
		await window.api.writeTextFile(projectPath, METADATA_FILE, JSON.stringify(data, null, 2));
	}
}));



