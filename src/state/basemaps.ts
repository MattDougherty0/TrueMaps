import { create } from "zustand";

export type BasemapKey = "topo" | "aerial" | "hillshade" | "slope" | "contours";

type BasemapState = {
	visible: Record<BasemapKey, boolean>;
	setVisible: (key: BasemapKey, value: boolean) => void;
};

export const useBasemapStore = create<BasemapState>((set) => ({
	visible: {
		topo: true,
		aerial: false,
		hillshade: true,
		slope: false,
		contours: true
	},
	setVisible: (key, value) =>
		set((s) => ({ visible: { ...s.visible, [key]: value } }))
}));


