import { create } from "zustand";

type AnalyticsState = {
	showSightingsHeatmap: boolean;
	showPathDensity: boolean;
	setShowSightingsHeatmap: (b: boolean) => void;
	setShowPathDensity: (b: boolean) => void;
};

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
	showSightingsHeatmap: false,
	showPathDensity: false,
	setShowSightingsHeatmap: (b) => set({ showSightingsHeatmap: b }),
	setShowPathDensity: (b) => set({ showPathDensity: b })
}));


