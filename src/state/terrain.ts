import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";

export type TerrainState = {
	enabled: boolean;
	verticalExaggeration: number;
	maxPitch: number;
	ionToken?: string;
	terrainUrl?: string;
	terrainAssetId?: number;
	terrariumUrl?: string;
	setEnabled: (enabled: boolean) => void;
	setVerticalExaggeration: (value: number) => void;
	setMaxPitch: (value: number) => void;
	setIonToken: (token?: string) => void;
	setTerrainUrl: (url?: string) => void;
	setTerrainAssetId: (assetId?: number | null) => void;
	setTerrariumUrl: (url?: string) => void;
};

const envIonToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
const envTerrainUrl = import.meta.env.VITE_CESIUM_TERRAIN_URL;
const envTerrainAssetId = import.meta.env.VITE_CESIUM_TERRAIN_ASSET_ID;
const envTerrariumUrl = import.meta.env.VITE_TERRAIN_TERRARIUM_URL;
const DEFAULT_TERRARIUM_TEMPLATE =
	"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const cleanString = (value: unknown): string | undefined =>
	typeof value === "string" && value.trim().length ? value.trim() : undefined;

const clampExaggeration = (value: number) => Math.min(8, Math.max(0.5, Number.isFinite(value) ? value : 1));
const clampPitch = (value: number) => Math.min(89, Math.max(30, Number.isFinite(value) ? value : 85));

const storedIonToken =
	typeof window !== "undefined" ? cleanString(window.localStorage.getItem("ion.token") || undefined) : undefined;
// Prefer env over localStorage so .env is the permanent source of truth
const initialIonToken = cleanString(envIonToken) ?? storedIonToken;
const initialTerrainUrl = cleanString(envTerrainUrl);
const initialTerrarium = cleanString(envTerrariumUrl) ?? DEFAULT_TERRARIUM_TEMPLATE;

const terrainStore = createStore<TerrainState>((set) => ({
	enabled: Boolean(initialIonToken || initialTerrainUrl || initialTerrarium),
	verticalExaggeration: 1.6,
	maxPitch: 85,
	ionToken: initialIonToken,
	terrainUrl: initialTerrainUrl,
	terrariumUrl: initialTerrarium,
	terrainAssetId: (() => {
		// Prefer env over localStorage
		const envVal =
			typeof envTerrainAssetId === "string" && envTerrainAssetId.trim()
				? Number.parseInt(envTerrainAssetId, 10)
				: undefined;
		if (typeof envVal === "number" && !Number.isNaN(envVal)) return envVal;
		if (typeof window !== "undefined") {
			const stored = window.localStorage.getItem("ion.assetId");
			if (stored && stored.trim() && !Number.isNaN(Number(stored))) return Number(stored);
		}
		return undefined;
	})(),
	setEnabled: (enabled) => set({ enabled }),
	setVerticalExaggeration: (value) => set({ verticalExaggeration: clampExaggeration(value) }),
	setMaxPitch: (value) => set({ maxPitch: clampPitch(value) }),
	setIonToken: (token) =>
		set(() => {
			const cleaned = cleanString(token);
			try {
				if (typeof window !== "undefined") {
					if (cleaned) window.localStorage.setItem("ion.token", cleaned);
					else window.localStorage.removeItem("ion.token");
				}
			} catch {
				// ignore storage errors
			}
			return { ionToken: cleaned };
		}),
	setTerrainUrl: (url) => set({ terrainUrl: cleanString(url) }),
	setTerrainAssetId: (assetId) =>
		set(() => {
			const value =
				assetId === null || assetId === undefined || Number.isNaN(Number(assetId))
					? undefined
					: Number(assetId);
			try {
				if (typeof window !== "undefined") {
					if (typeof value === "number") window.localStorage.setItem("ion.assetId", String(value));
					else window.localStorage.removeItem("ion.assetId");
				}
			} catch {
				// ignore storage errors
			}
			return { terrainAssetId: value };
		}),
	setTerrariumUrl: (url) =>
		set({ terrariumUrl: cleanString(url) ?? DEFAULT_TERRARIUM_TEMPLATE })
}));

export const useTerrainPreferences = <T>(selector: (state: TerrainState) => T) =>
	useStore(terrainStore, selector);
export const useTerrainPreferenceState = () => useStore(terrainStore);
export const getTerrainState = () => terrainStore.getState();
export const subscribeTerrain = terrainStore.subscribe;


