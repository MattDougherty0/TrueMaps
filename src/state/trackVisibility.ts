import { create } from "zustand";

export type TrackInfo = {
	id: string;
	name: string;
	visible: boolean;
};

type TrackVisibilityState = {
	// Map of track ID -> visibility
	trackVisibility: Record<string, boolean>;
	// List of known tracks (for UI)
	tracks: TrackInfo[];
	// Set visibility for a specific track
	setTrackVisible: (trackId: string, visible: boolean) => void;
	// Toggle all tracks on/off
	setAllTracksVisible: (visible: boolean) => void;
	// Register tracks from loaded data
	registerTracks: (tracks: Array<{ id: string; name: string }>) => void;
	// Check if a track is visible
	isTrackVisible: (trackId: string) => boolean;
};

export const useTrackVisibilityStore = create<TrackVisibilityState>((set, get) => ({
	trackVisibility: {},
	tracks: [],

	setTrackVisible: (trackId, visible) =>
		set((s) => ({
			trackVisibility: { ...s.trackVisibility, [trackId]: visible },
			tracks: s.tracks.map((t) =>
				t.id === trackId ? { ...t, visible } : t
			)
		})),

	setAllTracksVisible: (visible) =>
		set((s) => {
			const newVisibility: Record<string, boolean> = {};
			s.tracks.forEach((t) => {
				newVisibility[t.id] = visible;
			});
			return {
				trackVisibility: newVisibility,
				tracks: s.tracks.map((t) => ({ ...t, visible }))
			};
		}),

	registerTracks: (newTracks) =>
		set((s) => {
			const existingIds = new Set(s.tracks.map((t) => t.id));
			const tracksToAdd = newTracks.filter((t) => !existingIds.has(t.id));
			
			// Preserve existing visibility state, default new tracks to visible
			const newVisibility = { ...s.trackVisibility };
			tracksToAdd.forEach((t) => {
				if (!(t.id in newVisibility)) {
					newVisibility[t.id] = true;
				}
			});

			const allTracks = [
				...s.tracks,
				...tracksToAdd.map((t) => ({
					id: t.id,
					name: t.name,
					visible: newVisibility[t.id] ?? true
				}))
			];

			// Update existing tracks visibility from state
			const updatedTracks = allTracks.map((t) => ({
				...t,
				visible: newVisibility[t.id] ?? true
			}));

			return {
				trackVisibility: newVisibility,
				tracks: updatedTracks
			};
		}),

	isTrackVisible: (trackId) => {
		const visibility = get().trackVisibility[trackId];
		// Default to visible if not explicitly set
		return visibility !== false;
	}
}));

