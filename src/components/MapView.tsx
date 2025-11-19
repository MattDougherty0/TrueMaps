import { useEffect, useRef } from "react";
import "ol/ol.css";
import "cesium/Build/Cesium/Widgets/widgets.css";
import OLMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls, ScaleLine, FullScreen } from "ol/control";
import { fromLonLat, toLonLat } from "ol/proj";
import OLCesium from "olcs/OLCesium";
import * as CesiumGlobal from "cesium";
import {
	Ion,
	Math as CesiumMath,
	CesiumTerrainProvider,
	EllipsoidTerrainProvider,
	createWorldTerrainAsync,
	Cartesian3,
	EasingFunction,
	ArcGisMapServerImageryProvider,
	WebMercatorTilingScheme,
	Credit,
	OpenStreetMapImageryProvider,
	createWorldImageryAsync,
	IonWorldImageryStyle,
	type ImageryProvider,
	type ImageryLayer
} from "cesium";
import { getMap, setMap, setCesium } from "../state/map";
import { getTerrainState, subscribeTerrain, type TerrainState } from "../state/terrain";
import TerrariumTerrainProvider from "../lib/terrain/TerrariumProvider";
import { getCameraState, setCameraState, type CameraState } from "../state/camera";
import { useBasemapStore, type BasemapKey } from "../state/basemaps";

if (typeof window !== "undefined" && !(window as any).Cesium) {
	(window as any).Cesium = CesiumGlobal;
}

	let detachTerrainError: (() => void) | null = null;

	async function applyTerrainProvider(olCesium: OLCesium, state: TerrainState, abort: { cancelled: boolean }) {
	const scene = olCesium.getCesiumScene();
	if (state.ionToken) {
		Ion.defaultAccessToken = state.ionToken;
	}
	const attachProvider = (provider: unknown, label: string) => {
		const terrainProvider = provider as CesiumTerrainProvider;
		if (detachTerrainError) {
			try {
				detachTerrainError();
			} catch {
				// ignore
			}
			detachTerrainError = null;
		}
		scene.terrainProvider = provider as any;
		scene.requestRender();
	if (terrainProvider?.errorEvent) {
			const listener = (error: unknown) => {
				if (!abort.cancelled) {
					console.error(`[terrain] Provider error for ${label}`, error);
				}
			};
			terrainProvider.errorEvent.addEventListener(listener);
			detachTerrainError = () => {
				try {
					terrainProvider.errorEvent.removeEventListener(listener);
				} catch {
					// ignore
				}
			};
		}
	if (import.meta.env.DEV && typeof terrainProvider?.requestTileGeometry === "function") {
		const originalRequest = terrainProvider.requestTileGeometry;
		let loggedTiles = 0;
		terrainProvider.requestTileGeometry = function (...args) {
			if (loggedTiles < 10) {
				const [x, y, level] = args;
				console.debug(`[terrain] Requesting tile L${level} ${x}/${y} for ${label}`);
				loggedTiles += 1;
			}
			return originalRequest.apply(this, args as Parameters<typeof originalRequest>);
		};
	}
		if (terrainProvider && "readyPromise" in terrainProvider && terrainProvider.readyPromise) {
			void terrainProvider.readyPromise
				.then(() => {
					if (!abort.cancelled) {
						console.info(`[terrain] ${label} ready.`);
					}
				})
				.catch((error) => {
					if (!abort.cancelled) {
						console.error(`[terrain] ${label} failed to become ready`, error);
					}
				});
		} else {
			console.info(`[terrain] ${label} set (synchronous provider).`);
		}
	};
	try {
		if (state.terrainUrl) {
			const provider = await CesiumTerrainProvider.fromUrl(state.terrainUrl, {
				requestVertexNormals: true,
				requestWaterMask: false
			});
			if (!abort.cancelled) {
				attachProvider(provider, `Custom terrain URL ${state.terrainUrl}`);
				console.debug("[terrain] Provider details:", provider);
			}
		} else if (state.terrainAssetId !== undefined && state.terrainAssetId !== null && state.ionToken) {
			const provider = await CesiumTerrainProvider.fromIonAssetId(state.terrainAssetId, {
				requestVertexNormals: true,
				requestWaterMask: true
			});
			if (!abort.cancelled) {
				attachProvider(provider, `Cesium Ion asset ${state.terrainAssetId}`);
				console.debug("[terrain] Provider details:", provider);
				console.info(
					`[terrain] Cesium Ion asset ${state.terrainAssetId} active with token (usage should appear in Ion dashboard).`
				);
			}
		} else if (state.ionToken) {
			const provider = await createWorldTerrainAsync();
			if (!abort.cancelled) {
				attachProvider(provider, "Cesium World Terrain");
				console.info("[terrain] Using Cesium World Terrain (Ion token provided, no asset id).");
			}
		} else if (state.terrariumUrl) {
			const provider = new TerrariumTerrainProvider({
				urlTemplate: state.terrariumUrl
			});
			if (!abort.cancelled) {
				attachProvider(provider as unknown as CesiumTerrainProvider, "Terrarium fallback tiles");
				console.info("[terrain] Using Terrarium fallback tiles:", state.terrariumUrl);
			}
		} else if (!abort.cancelled) {
			attachProvider(new EllipsoidTerrainProvider(), "Ellipsoid terrain");
			console.warn("[terrain] No terrain source configured; falling back to ellipsoid.");
		}
	} catch (error) {
		if (!abort.cancelled) {
			console.error("[terrain] Failed to load requested terrain provider. Falling back to ellipsoid.", error);
			attachProvider(new EllipsoidTerrainProvider(), "Ellipsoid fallback");
		}
	}
}

type CameraPoseOptions = {
	animate?: boolean;
	duration?: number;
	lonLat?: [number, number];
	heightOverride?: number;
};

function resolveLonLat(): [number, number] {
	const map = getMap();
	const center = map?.getView().getCenter();
	if (!center) return [0, 0];
	const [lon, lat] = toLonLat(center);
	return [Number.isFinite(lon) ? lon : 0, Number.isFinite(lat) ? lat : 0];
}

function applyCameraPose(olCesium: OLCesium, camera: CameraState, options: CameraPoseOptions = {}) {
	const scene = olCesium.getCesiumScene();
	const cameraController = scene.screenSpaceCameraController;
	const headingRad = CesiumMath.toRadians(camera.heading);
	const pitchRad = -CesiumMath.toRadians(camera.pitch);
	const [lon, lat] = options.lonLat ?? resolveLonLat();
	const height = Math.max(40, options.heightOverride ?? camera.height);
	const destination = Cartesian3.fromDegrees(lon, lat, height);
	const orientation = {
		heading: headingRad,
		pitch: pitchRad,
		roll: 0
	};

	if (options.animate) {
		scene.camera.flyTo({
			destination,
			orientation,
			duration: options.duration ?? 1.2,
			easingFunction: EasingFunction.QUADRATIC_OUT
		});
	} else {
		scene.camera.setView({
			destination,
			orientation
		});
	}

	// Maintain pitch constraints in case sliders extend beyond controller limits.
	cameraController.minimumPitch = CesiumMath.toRadians(-89.5);
}

export default function MapView() {
	const mapRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!mapRef.current) return;
		const cesiumBasemapLayers = new Map<string, ImageryLayer>();
		const cesiumBasemapOrder: BasemapKey[] = ["topo", "aerial"];
		let pendingBasemapRebuild = false;

		const createBasemapProvider = (key: BasemapKey): { provider: ImageryProvider; alpha?: number } | null => {
			try {
				switch (key) {
					case "topo":
						return {
							provider: new ArcGisMapServerImageryProvider({
								url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer",
								maximumLevel: 16,
								usePreCachedTilesIfAvailable: true,
								tilingScheme: new WebMercatorTilingScheme(),
								credit: new Credit("USGS Topographic Map")
							})
						};
					case "aerial":
						return {
							provider: new ArcGisMapServerImageryProvider({
								url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer",
								maximumLevel: 17,
								usePreCachedTilesIfAvailable: true,
								tilingScheme: new WebMercatorTilingScheme(),
								credit: new Credit("USGS Imagery")
							})
						};
					default:
						return null;
				}
			} catch (error) {
				console.error(`[cesium] Failed to create basemap provider for ${key}`, error);
				return null;
			}
		};

		let olCesium: OLCesium | null = null;

		const clearCesiumBasemaps = () => {
			if (!olCesium) return;
			const scene = olCesium.getCesiumScene();
			for (const layer of cesiumBasemapLayers.values()) {
				try {
					scene.imageryLayers.remove(layer, true);
				} catch (error) {
					console.warn("[cesium] Failed to remove basemap layer", error);
				}
			}
			cesiumBasemapLayers.clear();
			scene.requestRender();
		};

		const rebuildCesiumBasemaps = async () => {
			if (!olCesium || !olCesium.getEnabled()) return;
			const scene = olCesium.getCesiumScene();
			clearCesiumBasemaps();
			let addedAtLeastOne = false;
			const terrainState = getTerrainState();
			// Prioritize Ion imagery if token available (single layer for performance)
			if (terrainState.ionToken) {
				try {
					const ionImagery = await createWorldImageryAsync({
						style: IonWorldImageryStyle.AERIAL_WITH_LABELS
					});
					const layer = scene.imageryLayers.addImageryProvider(ionImagery);
					scene.imageryLayers.lowerToBottom(layer);
					cesiumBasemapLayers.set("__ion_base", layer);
					addedAtLeastOne = true;
					console.info("[cesium] Added Cesium ion world imagery base (single layer for performance).");
				} catch (error) {
					console.error("[cesium] Failed to attach ion world imagery base", error);
				}
			}
			// Only add one additional basemap if ion imagery failed, not multiple layers
			if (!addedAtLeastOne) {
				const visible = useBasemapStore.getState().visible;
				// Try topo first, then aerial, then OSM fallback
				if (visible.topo) {
					const config = createBasemapProvider("topo");
					if (config) {
						try {
							const layer = scene.imageryLayers.addImageryProvider(config.provider);
							cesiumBasemapLayers.set("topo", layer);
							addedAtLeastOne = true;
							console.info("[cesium] Added USGS Topo (single layer).");
						} catch (error) {
							console.error("[cesium] Failed to attach topo layer", error);
						}
					}
				}
				if (!addedAtLeastOne && visible.aerial) {
					const config = createBasemapProvider("aerial");
					if (config) {
						try {
							const layer = scene.imageryLayers.addImageryProvider(config.provider);
							cesiumBasemapLayers.set("aerial", layer);
							addedAtLeastOne = true;
							console.info("[cesium] Added USGS Aerial (single layer).");
						} catch (error) {
							console.error("[cesium] Failed to attach aerial layer", error);
						}
					}
				}
				if (!addedAtLeastOne) {
					try {
						const fallbackLayer = scene.imageryLayers.addImageryProvider(
							new OpenStreetMapImageryProvider({
								url: "https://tile.openstreetmap.org/"
							})
						);
						cesiumBasemapLayers.set("__fallback_osm", fallbackLayer);
						addedAtLeastOne = true;
						console.info("[cesium] Added OpenStreetMap fallback (single layer).");
					} catch (error) {
						console.error("[cesium] Failed to attach fallback imagery layer", error);
					}
				}
			}
			scene.requestRender();
		};

		const queueCesiumBasemapRebuild = () => {
			if (!olCesium || !olCesium.getEnabled() || pendingBasemapRebuild) return;
			pendingBasemapRebuild = true;
			requestAnimationFrame(() => {
				pendingBasemapRebuild = false;
				void rebuildCesiumBasemaps();
			});
		};

		// Default to US center if no project/boundary
		const defaultCenter = fromLonLat([-98, 39]); // Approximate US center
		const map = new OLMap({
			target: mapRef.current,
			controls: defaultControls().extend([new ScaleLine(), new FullScreen()]),
			view: new View({
				center: defaultCenter,
				zoom: 4
			})
		});
		setMap(map);

		const abort = { cancelled: false };
		const initialTerrain = getTerrainState();
		let unsubscribeBasemap: (() => void) | null = null;
		let removeTileProgressListener: (() => void) | null = null;
		try {
			olCesium = new OLCesium({ map, target: mapRef.current });
			const scene = olCesium.getCesiumScene();
			scene.screenSpaceCameraController.enableTilt = true;
			scene.screenSpaceCameraController.minimumZoomDistance = 50;
			scene.screenSpaceCameraController.maximumZoomDistance = 20000000;
			scene.screenSpaceCameraController.enableCollisionDetection = true;
			scene.screenSpaceCameraController.maximumPitch = CesiumMath.toRadians(initialTerrain.maxPitch);
			scene.screenSpaceCameraController.inertiaSpin = 0.92;
			scene.screenSpaceCameraController.inertiaTranslate = 0.9;
			scene.screenSpaceCameraController.inertiaZoom = 0.85;
			scene.screenSpaceCameraController.minimumPitch = CesiumMath.toRadians(-89.5);
			scene.globe.depthTestAgainstTerrain = true;
			scene.globe.enableLighting = false; // Disable lighting for better performance
			scene.globe.showSkirts = false;
			scene.globe.maximumScreenSpaceError = 2.5; // Lower quality = better performance
			scene.requestRenderMode = true;
			scene.maximumRenderTimeChange = Number.POSITIVE_INFINITY;
			scene.globe.baseColor = CesiumGlobal.Color.BLACK; // Simple base when imagery fails
			scene.globe.tileCacheSize = 100; // Reduce tile cache to save memory
			scene.verticalExaggeration = initialTerrain.verticalExaggeration;
			olCesium.setEnabled(initialTerrain.enabled);
			setCesium(olCesium);
			let lastTileProgress = -1;
			const onTileProgress = (pending: number) => {
				if (pending !== lastTileProgress) {
					lastTileProgress = pending;
					console.debug(`[terrain] Tile load progress: ${pending}`);
				}
			};
			scene.globe.tileLoadProgressEvent.addEventListener(onTileProgress);
			removeTileProgressListener = () => {
				try {
					scene.globe.tileLoadProgressEvent.removeEventListener(onTileProgress);
				} catch {
					// ignore
				}
			};
			const initialCamera = getCameraState();
			applyCameraPose(olCesium, initialCamera, { animate: false });
			void applyTerrainProvider(olCesium, initialTerrain, abort);
			if (initialTerrain.enabled) {
				queueCesiumBasemapRebuild();
			}
			unsubscribeBasemap = useBasemapStore.subscribe(
				() => {
					if (!olCesium || !olCesium.getEnabled()) return;
					queueCesiumBasemapRebuild();
				},
				(state) => state.visible
			);
		} catch (error) {
			console.error("Failed to start Cesium overlay", error);
			olCesium = null;
		}

		const onJump = (evt: Event) => {
			const detail = (evt as CustomEvent<{ lon: number; lat: number; zoom?: number }>).detail;
			if (!detail) return;
			const view = map.getView();
			const center = fromLonLat([detail.lon, detail.lat]);
			view.animate({
				center,
				zoom: detail.zoom ?? 16,
				duration: 600
			});

			if (olCesium && olCesium.getEnabled()) {
				const cameraState = getCameraState();
				const targetHeight = detail.zoom
					? Math.max(
							40,
							cameraState.height *
								Math.pow(0.55, Math.max(0, detail.zoom - (view.getZoom() ?? 16)))
					  )
					: cameraState.height;
				// Suppress camera sync during programmatic jump
				suppressCameraSync = true;
				applyCameraPose(olCesium, cameraState, {
					animate: true,
					lonLat: [detail.lon, detail.lat],
					heightOverride: targetHeight,
					duration: 1.35
				});
				// Re-enable sync after jump completes
				setTimeout(() => {
					suppressCameraSync = false;
				}, 1500);
			}
		};
		window.addEventListener("map:jump-to", onJump);

		const onCameraPoseEvent = (evt: Event) => {
			if (!olCesium || !olCesium.getEnabled()) return;
			const detail = (evt as CustomEvent<Partial<CameraState> & { animate?: boolean }>).detail ?? {};
			const current = getCameraState();
			// Use values from event detail directly (they're already updated in the store)
			// Fall back to current state only if not provided in event
			const merged: CameraState = {
				heading: detail.heading !== undefined ? detail.heading : current.heading,
				pitch: detail.pitch !== undefined ? detail.pitch : current.pitch,
				height: detail.height !== undefined ? detail.height : current.height,
				setHeading: current.setHeading,
				setPitch: current.setPitch,
				setHeight: current.setHeight
			};
			// Suppress camera sync during programmatic updates to prevent feedback loop
			suppressCameraSync = true;
			// Default to non-animated for slider responsiveness (only animate when explicitly requested)
			applyCameraPose(olCesium, merged, {
				animate: detail.animate ?? false,
				heightOverride: merged.height
			});
			// Re-enable sync after camera update completes
			setTimeout(() => {
				suppressCameraSync = false;
			}, detail.animate ? 1500 : 100);
		};
		window.addEventListener("map:set-camera-pose", onCameraPoseEvent);

		const unsubscribeTerrain = subscribeTerrain((state, previous) => {
			if (!olCesium) return;
			const scene = olCesium.getCesiumScene();

			if (state.enabled !== previous.enabled) {
				olCesium.setEnabled(state.enabled);
				if (state.enabled) {
					scene.requestRender();
					requestAnimationFrame(() => {
						const cameraState = getCameraState();
						// Suppress camera sync during terrain enable
						suppressCameraSync = true;
						applyCameraPose(olCesium as OLCesium, cameraState, { animate: true, duration: 1.3 });
						queueCesiumBasemapRebuild();
						// Re-enable sync after camera animation completes
						setTimeout(() => {
							suppressCameraSync = false;
						}, 1500);
					});
				} else {
					clearCesiumBasemaps();
				}
			}
			if (state.verticalExaggeration !== previous.verticalExaggeration) {
				scene.verticalExaggeration = state.verticalExaggeration;
				scene.requestRender();
			}
			if (state.maxPitch !== previous.maxPitch) {
				scene.screenSpaceCameraController.maximumPitch = CesiumMath.toRadians(state.maxPitch);
			}
			if (
				state.terrainUrl !== previous.terrainUrl ||
				state.terrainAssetId !== previous.terrainAssetId ||
				state.ionToken !== previous.ionToken ||
				state.terrariumUrl !== previous.terrariumUrl
			) {
				void applyTerrainProvider(olCesium, state, abort);
			}
		});

		let pendingCameraSync = false;
		let suppressCameraSync = false;
		const onCesiumCameraChanged = () => {
			if (pendingCameraSync || suppressCameraSync) return;
			pendingCameraSync = true;
			requestAnimationFrame(() => {
				pendingCameraSync = false;
				if (suppressCameraSync || !olCesium || !olCesium.getEnabled()) return;
				const scene = olCesium.getCesiumScene();
				const camera = scene.camera;
				const cartographic = scene.globe.ellipsoid.cartesianToCartographic(camera.position);
				if (!cartographic) return;
				const headingDeg = ((CesiumMath.toDegrees(camera.heading) % 360) + 360) % 360;
				const pitchDeg = Math.min(85, Math.max(5, -CesiumMath.toDegrees(camera.pitch)));
				const height = Math.max(40, cartographic.height);
				setCameraState({
					heading: headingDeg,
					pitch: pitchDeg,
					height
				});
			});
		};
		if (olCesium) {
			olCesium.getCesiumScene().camera.changed.addEventListener(onCesiumCameraChanged);
		}

		return () => {
			abort.cancelled = true;
			unsubscribeTerrain();
			if (olCesium) {
				olCesium.getCesiumScene().camera.changed.removeEventListener(onCesiumCameraChanged);
			}
			if (detachTerrainError) {
				try {
					detachTerrainError();
				} catch {
					// ignore
				}
				detachTerrainError = null;
			}
			window.removeEventListener("map:set-camera-pose", onCameraPoseEvent);
			window.removeEventListener("map:jump-to", onJump);
			setCesium(null);
			setMap(null);
			if (unsubscribeBasemap) {
				unsubscribeBasemap();
			}
			clearCesiumBasemaps();
			if (removeTileProgressListener) {
				try {
					removeTileProgressListener();
				} catch {
					// ignore
				}
			}
			if (olCesium) {
				olCesium.setEnabled(false);
				olCesium.destroy();
			}
			map.setTarget(undefined as unknown as HTMLElement);
		};
	}, []);

	return (
		<div
			ref={mapRef}
			style={{
				width: "100vw",
				height: "100vh"
			}}
		/>
	);
}


