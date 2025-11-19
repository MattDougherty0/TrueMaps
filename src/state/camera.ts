import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export type CameraState = {
	heading: number;
	pitch: number;
	height: number;
	setHeading: (deg: number) => void;
	setPitch: (deg: number) => void;
	setHeight: (meters: number) => void;
};

const normalizeHeading = (value: number) => {
	if (!Number.isFinite(value)) return 0;
	const normalized = value % 360;
	return normalized < 0 ? normalized + 360 : normalized;
};

const clampPitch = (value: number) => {
	if (!Number.isFinite(value)) return 45;
	return Math.min(85, Math.max(5, value));
};

const clampHeight = (value: number) => {
	if (!Number.isFinite(value)) return 1200;
	return Math.min(20000, Math.max(60, value));
};

const cameraStore = createStore<CameraState>((set) => ({
	heading: 315,
	pitch: 45,
	height: 1200,
	setHeading: (deg: number) => set({ heading: normalizeHeading(deg) }),
	setPitch: (deg: number) => set({ pitch: clampPitch(deg) }),
	setHeight: (meters: number) => set({ height: clampHeight(meters) })
}));

export const useCameraPreferences = <T>(selector: (state: CameraState) => T) =>
	useStore(cameraStore, selector);
export const getCameraState = () => cameraStore.getState();
export const subscribeCamera = cameraStore.subscribe;
export const setCameraState = (partial: Partial<CameraState>) => {
	const current = cameraStore.getState();
	const nextHeading =
		partial.heading !== undefined ? normalizeHeading(partial.heading) : current.heading;
	const nextPitch = partial.pitch !== undefined ? clampPitch(partial.pitch) : current.pitch;
	const nextHeight = partial.height !== undefined ? clampHeight(partial.height) : current.height;
	cameraStore.setState({
		heading: nextHeading,
		pitch: nextPitch,
		height: nextHeight
	});
};


