import { create } from "zustand";

type HuntSelectionState = {
	selectedHuntId: string | null;
	setSelectedHuntId: (id: string | null) => void;
};

export const useHuntSelection = create<HuntSelectionState>((set) => ({
	selectedHuntId: null,
	setSelectedHuntId: (id) => set({ selectedHuntId: id })
}));


