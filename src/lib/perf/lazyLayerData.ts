import { useVisibilityStore } from "../../state/visibility";
import type { LayerId } from "../geo/schema";
import { enqueueLayerLoad } from "./layerLoadQueue";

/** Defer GeoJSON load until the layer is visible (or force/reload). */
export function createLazyLayerLoader(layerId: LayerId, reload: () => Promise<void>) {
	let dataLoaded = false;
	let loadInFlight: Promise<void> | null = null;

	const ensureData = (force = false) => {
		if (!force && dataLoaded) return;
		if (!force && loadInFlight) return;
		dataLoaded = true;
		loadInFlight = reload().finally(() => {
			loadInFlight = null;
		});
	};

	const requestData = (force = false) => {
		if (force) {
			ensureData(true);
			return;
		}
		if (layerId === "property_boundary") {
			ensureData();
			return;
		}
		enqueueLayerLoad(async () => ensureData());
	};

	const loadIfVisible = (force = false) => {
		if (force || useVisibilityStore.getState().isLayerVisible(layerId)) {
			requestData(force);
		}
	};

	const onReloadAll = () => {
		if (dataLoaded || useVisibilityStore.getState().isLayerVisible(layerId)) {
			requestData(true);
		}
	};

	return {
		requestData,
		loadIfVisible,
		onReloadAll,
		isLoaded: () => dataLoaded
	};
}
