import { create } from "zustand";
import type { LayerId } from "../lib/geo/schema";

export type Preset = "everything" | "terrain" | "sign" | "hunts";
export type TimeWindow = "all" | "1y" | "5y";

type VisibilityState = {
	preset: Preset;
	timeWindow: TimeWindow;
	setPreset: (p: Preset) => void;
	setTimeWindow: (w: TimeWindow) => void;
	overrides: Partial<Record<LayerId, boolean>>;
	setLayerOverride: (layerId: LayerId, visible: boolean | undefined) => void;
	isLayerVisible: (layerId: LayerId) => boolean;
};

const terrainLayers: LayerId[] = [
	"property_boundary",
	"streams",
	"cliffs",
	"ravines",
	"big_rocks",
	"tree_stands",
	"bedding_areas",
	"open_woods",
	"acorn_flats",
	"trails"
];

const signLayers: LayerId[] = [
	"scrapes",
	"rubs",
	"animal_sign",
	"mast_check_points",
	"beds_points",
	"bedding_areas",
	"trails"
];

const huntLayers: LayerId[] = ["hunts", "harvests", "animal_sightings", "animal_paths", "stands"];

export const useVisibilityStore = create<VisibilityState>((set, get) => ({
	preset: "everything",
	timeWindow: "all",
	setPreset: (p) => set({ preset: p }),
	setTimeWindow: (w) => set({ timeWindow: w }),
	overrides: {},
	setLayerOverride: (layerId, visible) =>
		set((s) => {
			// If visible is undefined, remove the override to allow preset to take over
			if (visible === undefined) {
				const newOverrides = { ...s.overrides };
				delete newOverrides[layerId];
				return { overrides: newOverrides };
			}
			// Otherwise, set the override value
			return {
				overrides: { ...s.overrides, [layerId]: visible }
			};
		}),
	isLayerVisible: (layerId: LayerId) => {
		const preset = get().preset;
		const override = get().overrides[layerId];
		if (typeof override === "boolean") return override;
		if (preset === "everything") return true;
		if (preset === "terrain") return terrainLayers.includes(layerId);
		if (preset === "sign") return signLayers.includes(layerId);
		if (preset === "hunts") return huntLayers.includes(layerId);
		return true;
	}
}));


