import Map from "ol/Map";
import type OLCesium from "olcs/OLCesium";
import { useEffect, useState } from "react";

let instance: Map | null = null;
const listeners = new Set<(map: Map | null) => void>();
let cesiumInstance: OLCesium | null = null;
const cesiumListeners = new Set<(ol3d: OLCesium | null) => void>();

export function setMap(map: Map | null): Map | null {
	instance = map;
	for (const listener of listeners) {
		try {
			listener(instance);
		} catch (err) {
			console.error("Map listener error", err);
		}
	}
	return instance;
}

export function getMap(): Map | null {
	return instance;
}

export function setCesium(ol3d: OLCesium | null): OLCesium | null {
	cesiumInstance = ol3d;
	for (const listener of cesiumListeners) {
		try {
			listener(cesiumInstance);
		} catch (err) {
			console.error("Cesium listener error", err);
		}
	}
	return cesiumInstance;
}

export function getCesium(): OLCesium | null {
	return cesiumInstance;
}

export function subscribeMap(listener: (map: Map | null) => void): () => void {
	listeners.add(listener);
	listener(instance);
	return () => {
		listeners.delete(listener);
	};
}

export function subscribeCesium(listener: (ol3d: OLCesium | null) => void): () => void {
	cesiumListeners.add(listener);
	listener(cesiumInstance);
	return () => {
		cesiumListeners.delete(listener);
	};
}

export function useMapInstance(): Map | null {
	const [map, setMapState] = useState<Map | null>(instance);
	useEffect(() => subscribeMap(setMapState), []);
	return map;
}

export function useCesiumInstance(): OLCesium | null {
	const [ol3d, setCesiumState] = useState<OLCesium | null>(cesiumInstance);
	useEffect(() => subscribeCesium(setCesiumState), []);
	return ol3d;
}

