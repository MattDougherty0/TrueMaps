import { create } from "zustand";
import type { LayerId } from "../lib/geo/schema";

type SelectionState = {
	selected: { layerId: LayerId; feature: any } | null;
	setSelected: (payload: { layerId: LayerId; feature: any } | null) => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
	selected: null,
	setSelected: (payload) => set({ selected: payload })
}));


