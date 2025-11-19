import { create } from "zustand";

export type TemporalView = "all" | "permanentOnly" | "recentOnly";

type FiltersState = {
	species: Set<string>;
	signTypes: Set<string>;
	onlyMine: boolean;
	temporalView: TemporalView;
	setSpecies: (values: string[]) => void;
	toggleSpecies: (value: string) => void;
	setSignTypes: (values: string[]) => void;
	toggleSignType: (value: string) => void;
	setOnlyMine: (b: boolean) => void;
	setTemporalView: (v: TemporalView) => void;
	clear: () => void;
};

export const useFiltersStore = create<FiltersState>((set, get) => ({
	species: new Set<string>(),
	signTypes: new Set<string>(),
	onlyMine: false,
	temporalView: "all",
	setSpecies: (values) => set({ species: new Set(values) }),
	toggleSpecies: (value) =>
		set((s) => {
			const next = new Set(s.species);
			if (next.has(value)) next.delete(value);
			else next.add(value);
			return { species: next };
		}),
	setSignTypes: (values) => set({ signTypes: new Set(values) }),
	toggleSignType: (value) =>
		set((s) => {
			const next = new Set(s.signTypes);
			if (next.has(value)) next.delete(value);
			else next.add(value);
			return { signTypes: next };
		}),
	setOnlyMine: (b) => set({ onlyMine: b }),
	setTemporalView: (v) => set({ temporalView: v }),
	clear: () => set({ species: new Set(), signTypes: new Set(), onlyMine: false, temporalView: "all" })
}));


