import { useEffect, useRef } from "react";
import "ol/ol.css";
import "cesium/Build/Cesium/Widgets/widgets.css";
import OLMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls, ScaleLine, FullScreen } from "ol/control";
import { fromLonLat, toLonLat, transform } from "ol/proj";
import OLCesium from "olcs/OLCesium";
import * as CesiumGlobal from "cesium";
import {
	Ion,
	Math as CesiumMath,
	CesiumTerrainProvider,
	EllipsoidTerrainProvider,
	createWorldTerrainAsync,
	Cartesian3,
	HeadingPitchRange,
	BoundingSphere,
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
import useAppStore from "../state/store";
import { mbtilesUrl } from "../lib/mbtiles/client";

if (typeof window !== "undefined" && !(window as any).Cesium) {
	(window as any).Cesium = CesiumGlobal;
}

	let detachTerrainError: (() => void) | null = null;

	async function applyTerrainProvider(olCesium: any, state: TerrainState, abort: { cancelled: boolean }) {
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
		const readyPromise = (terrainProvider as any)?.readyPromise as Promise<unknown> | undefined;
		if (readyPromise) {
			void readyPromise
				.then(() => {
					if (!abort.cancelled) {
						console.info(`[terrain] ${label} ready.`);
					}
				})
				.catch((error: unknown) => {
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
	// OpenLayers' toLonLat assumes EPSG:3857 inputs; if the view projection differs, transform.
	const projection = map?.getView().getProjection();
	const code = projection?.getCode?.() || "EPSG:3857";
	const lonLat =
		code === "EPSG:3857"
			? (toLonLat(center) as [number, number])
			: (transform(center, projection as any, "EPSG:4326") as [number, number]);
	const [lon, lat] = lonLat;
	return [Number.isFinite(lon) ? lon : 0, Number.isFinite(lat) ? lat : 0];
}

function applyCameraPose(olCesium: any, camera: CameraState, options: CameraPoseOptions = {}) {
	const scene = olCesium.getCesiumScene();
	const cameraController = scene.screenSpaceCameraController;
	const headingRad = CesiumMath.toRadians(camera.heading);
	const pitchRad = -CesiumMath.toRadians(camera.pitch);
	const [lon, lat] = options.lonLat ?? resolveLonLat();
	const range = Math.max(40, options.heightOverride ?? camera.height);
	// Keep the *ground target* fixed at the current 2D center, otherwise a pitched camera
	// placed "above" the center will look away and appear to shift the map by miles.
	const target = Cartesian3.fromDegrees(lon, lat, 0);
	const offset = new HeadingPitchRange(headingRad, pitchRad, range);

	if (options.animate) {
		scene.camera.flyToBoundingSphere(new BoundingSphere(target, 0), {
			offset,
			duration: options.duration ?? 1.2,
			easingFunction: EasingFunction.QUADRATIC_OUT,
			complete: () => {
				// Reset any lookAt transform so user navigation behaves normally.
				try {
					scene.camera.lookAtTransform(CesiumGlobal.Matrix4.IDENTITY);
				} catch {
					// ignore
				}
			}
		});
	} else {
		scene.camera.lookAt(target, offset);
		// Reset any lookAt transform so user navigation behaves normally.
		try {
			scene.camera.lookAtTransform(CesiumGlobal.Matrix4.IDENTITY);
		} catch {
			// ignore
		}
	}

	// Maintain pitch constraints in case sliders extend beyond controller limits.
	cameraController.minimumPitch = CesiumMath.toRadians(-89.5);
}

export default function MapView() {
	const mapRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!mapRef.current) return;
		const cesiumBasemapLayers = new Map<string, ImageryLayer>();
		let pendingBasemapRebuild = false;

		const createBasemapProvider = async (
			key: BasemapKey
		): Promise<{ provider: ImageryProvider; alpha?: number } | null> => {
			try {
				switch (key) {
					case "topo":
						return {
							provider: (await ArcGisMapServerImageryProvider.fromUrl(
								"https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer",
								{
									maximumLevel: 16,
									usePreCachedTilesIfAvailable: true,
									tilingScheme: new WebMercatorTilingScheme(),
									credit: new Credit("USGS Topographic Map")
								} as any
							)) as unknown as ImageryProvider
						};
					case "aerial":
						return {
							provider: (await ArcGisMapServerImageryProvider.fromUrl(
								"https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer",
								{
									maximumLevel: 17,
									usePreCachedTilesIfAvailable: true,
									tilingScheme: new WebMercatorTilingScheme(),
									credit: new Credit("USGS Imagery")
								} as any
							)) as unknown as ImageryProvider
						};
					case "hillshade": {
						const { projectPath, activePropertyId } = useAppStore.getState();
						if (!projectPath) return null;
						return {
							provider: new (CesiumGlobal as any).UrlTemplateImageryProvider({
								url: mbtilesUrl("hillshade", activePropertyId),
								tilingScheme: new WebMercatorTilingScheme()
							}) as ImageryProvider,
							alpha: 0.55
						};
					}
					case "slope": {
						const { projectPath, activePropertyId } = useAppStore.getState();
						if (!projectPath) return null;
						return {
							provider: new (CesiumGlobal as any).UrlTemplateImageryProvider({
								url: mbtilesUrl("slope", activePropertyId),
								tilingScheme: new WebMercatorTilingScheme()
							}) as ImageryProvider,
							alpha: 0.45
						};
					}
					default:
						return null;
				}
			} catch (error) {
				console.error(`[cesium] Failed to create basemap provider for ${key}`, error);
				return null;
			}
		};

		let olCesium: any | null = null;
		// Keep a handle so we can force a resync when switching modes.
		let vectorSync: any | null = null;

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
			const visible = useBasemapStore.getState().visible;

			// In 3D, treat Topo/Aerial toggles as the base selector (prefer aerial if both checked).
			// Ion imagery is *fallback* only, otherwise toggles would appear to do nothing.
			const preferredBase: BasemapKey | null = visible.aerial ? "aerial" : visible.topo ? "topo" : null;
			if (preferredBase) {
				const config = await createBasemapProvider(preferredBase);
				if (config) {
					try {
						const layer = scene.imageryLayers.addImageryProvider(config.provider);
						if (typeof config.alpha === "number") layer.alpha = config.alpha;
						scene.imageryLayers.lowerToBottom(layer);
						cesiumBasemapLayers.set(preferredBase, layer);
						addedAtLeastOne = true;
						console.info(`[cesium] Added ${preferredBase} basemap (3D).`);
					} catch (error) {
						console.error(`[cesium] Failed to attach ${preferredBase} layer`, error);
					}
				}
			}

			if (!addedAtLeastOne && terrainState.ionToken) {
				try {
					const ionImagery = await createWorldImageryAsync({
						style: IonWorldImageryStyle.AERIAL_WITH_LABELS
					});
					const layer = scene.imageryLayers.addImageryProvider(ionImagery);
					scene.imageryLayers.lowerToBottom(layer);
					cesiumBasemapLayers.set("__ion_base", layer);
					addedAtLeastOne = true;
					console.info("[cesium] Added Cesium ion world imagery base (fallback).");
				} catch (error) {
					console.error("[cesium] Failed to attach ion world imagery base", error);
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
					console.info("[cesium] Added OpenStreetMap fallback.");
				} catch (error) {
					console.error("[cesium] Failed to attach fallback imagery layer", error);
				}
			}

			// Optional overlays (3D): hillshade + slope.
			for (const overlayKey of ["hillshade", "slope"] as BasemapKey[]) {
				if (!visible[overlayKey]) continue;
				const cfg = await createBasemapProvider(overlayKey);
				if (!cfg) continue;
				try {
					const layer = scene.imageryLayers.addImageryProvider(cfg.provider);
					if (typeof cfg.alpha === "number") layer.alpha = cfg.alpha;
					cesiumBasemapLayers.set(overlayKey, layer);
					scene.imageryLayers.raiseToTop(layer);
				} catch (error) {
					console.error(`[cesium] Failed to attach overlay ${overlayKey}`, error);
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

		// OL-Cesium supports clamping via an `altitudeMode` property on layers/features.
		// When terrain is enabled, unclamped vectors can appear to "slide" relative to the ground.
		const setVectorAltitudeMode = (mode: "clampToGround" | undefined) => {
			try {
				map.getLayers().forEach((layer: any) => {
					// apply to vector layers only (best-effort duck typing)
					const src = layer?.getSource?.();
					const isVectorLike =
						!!src && typeof src.getFeatures === "function" && typeof src.on === "function";
					if (!isVectorLike) return;
					if (mode) layer.set("altitudeMode", mode);
					else layer.unset?.("altitudeMode", true);
				});
			} catch {
				// ignore
			}
		};

		const abort = { cancelled: false };
		const initialTerrain = getTerrainState();
		let unsubscribeBasemap: (() => void) | null = null;
		let unsubscribeApp: (() => void) | null = null;
		let removeTileProgressListener: (() => void) | null = null;

		const ensureOlCesium = () => {
			if (olCesium || !mapRef.current || abort.cancelled) return olCesium;
			try {
				olCesium = new OLCesium({ map, target: mapRef.current });
				try {
					const syncs: any[] = ((olCesium as any).synchronizers_ as any[]) || [];
					vectorSync =
						syncs.find((s) =>
							(s?.constructor?.name || "").toLowerCase().includes("vectorsynchronizer")
						) || null;
				} catch {
					vectorSync = null;
				}
				const scene = olCesium.getCesiumScene();
				scene.screenSpaceCameraController.enableTilt = true;
				scene.screenSpaceCameraController.minimumZoomDistance = 50;
				scene.screenSpaceCameraController.maximumZoomDistance = 20000000;
				scene.screenSpaceCameraController.enableCollisionDetection = true;
				scene.screenSpaceCameraController.maximumPitch = CesiumMath.toRadians(
					getTerrainState().maxPitch
				);
				scene.screenSpaceCameraController.inertiaSpin = 0.92;
				scene.screenSpaceCameraController.inertiaTranslate = 0.9;
				scene.screenSpaceCameraController.inertiaZoom = 0.85;
				scene.screenSpaceCameraController.minimumPitch = CesiumMath.toRadians(-89.5);
				// NOTE: depthTestAgainstTerrain can hide OL-Cesium vectors at ellipsoid height.
				scene.globe.depthTestAgainstTerrain = false;
				scene.globe.enableLighting = false;
				scene.globe.showSkirts = false;
				scene.globe.maximumScreenSpaceError = 2.5;
				scene.requestRenderMode = true;
				scene.maximumRenderTimeChange = Number.POSITIVE_INFINITY;
				scene.globe.baseColor = CesiumGlobal.Color.BLACK;
				scene.globe.tileCacheSize = 100;
				scene.verticalExaggeration = getTerrainState().verticalExaggeration;
				olCesium.setEnabled(false);
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
				if (!unsubscribeBasemap) {
					unsubscribeBasemap = useBasemapStore.subscribe(() => {
						if (!olCesium || !olCesium.getEnabled()) return;
						queueCesiumBasemapRebuild();
					});
				}
				if (!unsubscribeApp) {
					unsubscribeApp = useAppStore.subscribe(() => {
						if (!olCesium || !olCesium.getEnabled()) return;
						queueCesiumBasemapRebuild();
					});
				}
			} catch (error) {
				console.error("Failed to start Cesium overlay", error);
				olCesium = null;
			}
			return olCesium;
		};

		// Defer Cesium until 3D is requested (default is 2D).
		if (initialTerrain.enabled) {
			ensureOlCesium();
			if (olCesium) {
				applyCameraPose(olCesium, getCameraState(), { animate: false });
				void applyTerrainProvider(olCesium, initialTerrain, abort);
				olCesium.setEnabled(true);
				queueCesiumBasemapRebuild();
			}
		}

		let pendingCameraSync = false;
		let suppressCameraSync = false;
		let cameraChangedAttached = false;

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

		const unsubscribeTerrain = subscribeTerrain((state, previous) => {
			if (state.enabled && !olCesium) {
				ensureOlCesium();
				if (olCesium && !cameraChangedAttached) {
					olCesium.getCesiumScene().camera.changed.addEventListener(onCesiumCameraChanged);
					cameraChangedAttached = true;
				}
				if (olCesium) {
					void applyTerrainProvider(olCesium, state, abort);
				}
			}
			if (!olCesium) return;
			const scene = olCesium.getCesiumScene();

			if (state.enabled !== previous.enabled) {
				// Clamp vectors when entering 3D so overlays stay glued to the terrain.
				if (state.enabled) {
					setVectorAltitudeMode("clampToGround");
				} else {
					// restore default behavior in 2D
					setVectorAltitudeMode(undefined);
				}
				olCesium.setEnabled(state.enabled);
				if (state.enabled) {
					// Force re-sync of vector layers *after* we set altitudeMode, because OL-Cesium
					// synchronizers are constructed early and may have already built counterparts.
					try {
						if (vectorSync && typeof vectorSync.destroyAll === "function" && typeof vectorSync.synchronize === "function") {
							vectorSync.destroyAll();
							vectorSync.synchronize();
						}
					} catch (err) {
						console.warn("[cesium] Failed to rebuild vector synchronizer", err);
					}
					scene.requestRender();
					requestAnimationFrame(() => {
						const cameraState = getCameraState();
						// Suppress camera sync during terrain enable
						suppressCameraSync = true;
						applyCameraPose(olCesium as any, cameraState, { animate: true, duration: 1.3 });
						queueCesiumBasemapRebuild();
						// Re-enable sync after camera animation completes
						setTimeout(() => {
							suppressCameraSync = false;
						}, 1500);
					});
				} else {
					clearCesiumBasemaps();
					// Safety: OL-Cesium hides the OL root layer group when 3D is enabled.
					// If that restore ever fails, all layers look "gone" even in 2D.
					try {
						map.getLayerGroup().setVisible(true);
					} catch {
						// ignore
					}
					// Nudge a render to ensure layers repaint immediately.
					try {
						map.render();
					} catch {
						// ignore
					}
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

		if (olCesium) {
			olCesium.getCesiumScene().camera.changed.addEventListener(onCesiumCameraChanged);
			cameraChangedAttached = true;
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
			if (unsubscribeApp) {
				unsubscribeApp();
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


