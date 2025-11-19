import { create } from "zustand";

export type HistoricalEntry = {
	id: string;
	label: string; // e.g., "Wayback 2018-05", "NAIP 2019"
	year: number;
	// For XYZ-tiled sources (Wayback, generic XYZ)
	urlTemplate?: string; // XYZ {z}/{y}/{x}
	// For ArcGIS ImageServer sources (e.g., NAIP time-enabled)
	arcgisImageUrl?: string; // .../arcgis/rest/services/.../ImageServer
	timeParam?: string; // e.g., "2019-01-01,2019-12-31"
	// For ArcGIS MapServer tiled sources
	arcgisMapUrl?: string; // .../arcgis/rest/services/.../MapServer
	type?: "xyz" | "arcgis-image" | "arcgis-map";
	attribution?: string;
};

type HistoricalState = {
	enabled: boolean;
	selectedId: string | null;
	entries: HistoricalEntry[];
	setEnabled: (b: boolean) => void;
	setSelected: (id: string | null) => void;
	addEntry: (entry: HistoricalEntry) => void;
	removeEntry: (id: string) => void;
};

// Seed with a useful default and leave room to add more from UI
export const useHistoricalImagery = create<HistoricalState>((set) => ({
	enabled: false,
	selectedId: null,
	entries: [
		{
			id: "usgs_latest",
			label: "USGS Imagery (Latest)",
			year: new Date().getFullYear(),
			urlTemplate:
				"https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
			attribution: "USGS"
		}
	],
	setEnabled: (b) => set({ enabled: b }),
	setSelected: (id) => set({ selectedId: id }),
	addEntry: (entry) =>
		set((s) => {
			const exists = s.entries.some((e) => e.id === entry.id);
			return exists ? s : { entries: [...s.entries, entry] };
		}),
	removeEntry: (id) =>
		set((s) => ({
			entries: s.entries.filter((e) => e.id !== id),
			selectedId: s.selectedId === id ? null : s.selectedId
		}))
}));


