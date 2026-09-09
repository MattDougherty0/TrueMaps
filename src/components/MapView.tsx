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
	Math as CesiumMath,
	Cartesian3,
	HeadingPitchRange,
	BoundingSphere,
	EasingFunction,
	Cartographic,
	sampleTerrainMostDetailed,
	type Cesium3DTileset,
	type ImageryLayer
} from "cesium";
import { getMap, setMap, setCesium } from "../state/map";
import { getTerrainState, subscribeTerrain } from "../state/terrain";
import { getCameraState, setCameraState, type CameraState } from "../state/camera";
import { useBasemapStore } from "../state/basemaps";
import {
	applyBestTerrainProvider,
	applyHuntingLight,
	clearGlobeImagery,
	configureGlobeScene,
	createAerialImageryProvider,
	createOsmFallbackProvider,
	createTopoImageryProvider,
	loadPhotorealisticTileset,
	removePhotorealisticTileset,
	styleAerialLayer,
	styleTopoOverlayLayer
} from "../lib/terrain/cesiumGlobe";

if (typeof window !== "undefined" && !(window as any).Cesium) {
	(window as any).Cesium = CesiumGlobal;
}

type CameraPoseOptions = {
	animate?: boolean;
	duration?: number;
	lonLat?: [number, number];
	heightOverride?: number;
};

type BasemapSnapshot = {
	topo: boolean;
	aerial: boolean;
	topoOverlay: boolean;
};

function resolveLonLat(): [number, number] {
	const map = getMap();
	const center = map?.getView().getCenter();
	if (!center) return [0, 0];
	const projection = map?.getView().getProjection();
	const code = projection?.getCode?.() || "EPSG:3857";
	const lonLat =
		code === "EPSG:3857"
			? (toLonLat(center) as [number, number])
			: (transform(center, projection as any, "EPSG:4326") as [number, number]);
	const [lon, lat] = lonLat;
	return [Number.isFinite(lon) ? lon : 0, Number.isFinite(lat) ? lat : 0];
}

async function sampleGroundHeight(scene: any, lon: number, lat: number): Promise<number> {
	const cartographic = Cartographic.fromDegrees(lon, lat);
	const loadedHeight = scene?.globe?.getHeight?.(cartographic);
	if (typeof loadedHeight === "number" && Number.isFinite(loadedHeight)) {
		return loadedHeight;
	}
	try {
		const [sampled] = await sampleTerrainMostDetailed(scene.terrainProvider, [
			Cartographic.fromDegrees(lon, lat)
		]);
		if (sampled && Number.isFinite(sampled.height)) return sampled.height;
	} catch {
		// Terrain tiles may not be ready yet.
	}
	return 0;
}

async function applyCameraPose(olCesium: any, camera: CameraState, options: CameraPoseOptions = {}) {
	const scene = olCesium.getCesiumScene();
	const cameraController = scene.screenSpaceCameraController;
	const headingRad = CesiumMath.toRadians(camera.heading);
	const pitchRad = -CesiumMath.toRadians(camera.pitch);
	const [lon, lat] = options.lonLat ?? resolveLonLat();
	const range = Math.max(40, options.heightOverride ?? camera.height);
	let groundHeight = 0;
	const loadedHeight = scene?.globe?.getHeight?.(Cartographic.fromDegrees(lon, lat));
	if (typeof loadedHeight === "number" && Number.isFinite(loadedHeight)) {
		groundHeight = loadedHeight;
	} else if (options.animate || options.lonLat) {
		groundHeight = await sampleGroundHeight(scene, lon, lat);
	}
	if (typeof scene.verticalExaggerationRelativeHeight === "number") {
		scene.verticalExaggerationRelativeHeight = groundHeight;
	}
	applyHuntingLight(scene, lon, lat);
	const target = Cartesian3.fromDegrees(lon, lat, groundHeight);
	const offset = new HeadingPitchRange(headingRad, pitchRad, range);

	if (options.animate) {
		scene.camera.flyToBoundingSphere(new BoundingSphere(target, 0), {
			offset,
			duration: options.duration ?? 1.2,
			easingFunction: EasingFunction.QUADRATIC_OUT,
			complete: () => {
				try {
					scene.camera.lookAtTransform(CesiumGlobal.Matrix4.IDENTITY);
				} catch {
					// ignore
				}
			}
		});
	} else {
		scene.camera.lookAt(target, offset);
		try {
			scene.camera.lookAtTransform(CesiumGlobal.Matrix4.IDENTITY);
		} catch {
			// ignore
		}
	}

	cameraController.minimumPitch = CesiumMath.toRadians(-89.5);
}

export default function MapView() {
	const mapRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!mapRef.current) return;
		const cesiumBasemapLayers = new Map<string, ImageryLayer>();
		let pendingBasemapRebuild = false;
		let twoDBasemapSnapshot: BasemapSnapshot | null = null;
		let meshTileset: Cesium3DTileset | null = null;
		let meshLoadGeneration = 0;
		let needsTerrainSettle = false;

		let olCesium: any | null = null;
		let vectorSync: any | null = null;

		const clearCesiumBasemaps = () => {
			if (!olCesium) return;
			const scene = olCesium.getCesiumScene();
			clearGlobeImagery(scene);
			cesiumBasemapLayers.clear();
			scene.requestRender();
		};

		const rebuildCesiumBasemaps = async () => {
			if (!olCesium || !olCesium.getEnabled()) return;
			const scene = olCesium.getCesiumScene();
			const terrainState = getTerrainState();
			const visible = useBasemapStore.getState().visible;
			clearGlobeImagery(scene);
			cesiumBasemapLayers.clear();

			const preferAerial = !!visible.aerial || !visible.topo;
			let added = false;

			try {
				if (preferAerial) {
					const provider = await createAerialImageryProvider(terrainState.ionToken);
					const layer = scene.imageryLayers.addImageryProvider(provider);
					styleAerialLayer(layer);
					scene.imageryLayers.lowerToBottom(layer);
					cesiumBasemapLayers.set("aerial", layer);
					added = true;
					console.info("[cesium] 3D aerial: current satellite mosaic.");
				} else {
					const provider = await createTopoImageryProvider();
					const layer = scene.imageryLayers.addImageryProvider(provider);
					scene.imageryLayers.lowerToBottom(layer);
					cesiumBasemapLayers.set("topo", layer);
					added = true;
					console.info("[cesium] 3D topo: USGS topographic map.");
				}
			} catch (error) {
				console.error("[cesium] Failed to attach 3D base imagery", error);
			}

			if (!added) {
				try {
					const fallback = await createOsmFallbackProvider();
					const layer = scene.imageryLayers.addImageryProvider(fallback);
					cesiumBasemapLayers.set("__fallback_osm", layer);
					added = true;
				} catch (error) {
					console.error("[cesium] OSM fallback failed", error);
				}
			}

			if (preferAerial && visible.topoOverlay) {
				try {
					const provider = await createTopoImageryProvider();
					const layer = scene.imageryLayers.addImageryProvider(provider);
					styleTopoOverlayLayer(layer);
					cesiumBasemapLayers.set("topoOverlay", layer);
					scene.imageryLayers.raiseToTop(layer);
				} catch (error) {
					console.error("[cesium] Topo overlay failed", error);
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

		const syncPhotorealisticMesh = async () => {
			if (!olCesium) return;
			const scene = olCesium.getCesiumScene();
			const wantMesh = olCesium.getEnabled() && getTerrainState().sceneMode3D === "mesh";
			const generation = ++meshLoadGeneration;
			if (!wantMesh) {
				removePhotorealisticTileset(scene, meshTileset);
				meshTileset = null;
				return;
			}
			if (meshTileset) return;
			const tileset = await loadPhotorealisticTileset(scene);
			if (generation !== meshLoadGeneration) {
				removePhotorealisticTileset(scene, tileset);
				return;
			}
			if (!tileset) {
				console.warn("[cesium] Mesh mode unavailable; staying on satellite terrain.");
				return;
			}
			meshTileset = tileset;
		};

		const enter3DBasemap = () => {
			const vis = useBasemapStore.getState().visible;
			twoDBasemapSnapshot = {
				topo: !!vis.topo,
				aerial: !!vis.aerial,
				topoOverlay: !!vis.topoOverlay
			};
			const setVisible = useBasemapStore.getState().setVisible;
			setVisible("aerial", true);
			setVisible("topo", false);
			setVisible("topoOverlay", false);
		};

		const leave3DBasemap = () => {
			if (!twoDBasemapSnapshot) return;
			const setVisible = useBasemapStore.getState().setVisible;
			setVisible("topo", twoDBasemapSnapshot.topo);
			setVisible("aerial", twoDBasemapSnapshot.aerial);
			setVisible("topoOverlay", twoDBasemapSnapshot.topoOverlay);
			twoDBasemapSnapshot = null;
		};

		const defaultCenter = fromLonLat([-98, 39]);
		const map = new OLMap({
			target: mapRef.current,
			controls: defaultControls().extend([new ScaleLine(), new FullScreen()]),
			view: new View({
				center: defaultCenter,
				zoom: 4
			})
		});
		setMap(map);

		const setVectorAltitudeMode = (mode: "clampToGround" | undefined) => {
			try {
				map.getLayers().forEach((layer: any) => {
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
		let removeTileProgressListener: (() => void) | null = null;
		let removePreRenderListener: (() => void) | null = null;

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
				configureGlobeScene(scene);
				scene.screenSpaceCameraController.maximumPitch = CesiumMath.toRadians(
					getTerrainState().maxPitch
				);
				scene.verticalExaggeration = getTerrainState().verticalExaggeration;
				olCesium.setEnabled(false);
				setCesium(olCesium);

				const onTileProgress = (pending: number) => {
					scene.requestRender();
					if (pending === 0 && needsTerrainSettle && olCesium?.getEnabled()) {
						needsTerrainSettle = false;
						void applyCameraPose(olCesium, getCameraState(), { animate: false });
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

				const onPreRender = () => {
					const [lon, lat] = resolveLonLat();
					applyHuntingLight(scene, lon, lat);
				};
				scene.preRender.addEventListener(onPreRender);
				removePreRenderListener = () => {
					try {
						scene.preRender.removeEventListener(onPreRender);
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
			} catch (error) {
				console.error("Failed to start Cesium overlay", error);
				olCesium = null;
			}
			return olCesium;
		};

		if (initialTerrain.enabled) {
			ensureOlCesium();
			if (olCesium) {
				enter3DBasemap();
				needsTerrainSettle = true;
				void applyCameraPose(olCesium, getCameraState(), { animate: false });
				void applyBestTerrainProvider(olCesium.getCesiumScene(), initialTerrain, abort);
				olCesium.setEnabled(true);
				queueCesiumBasemapRebuild();
				void syncPhotorealisticMesh();
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
			if (olCesium && olCesium.getEnabled()) {
				view.setCenter(center);
				if (detail.zoom) view.setZoom(detail.zoom);
				const cameraState = getCameraState();
				const targetHeight = detail.zoom
					? Math.max(80, 4500 / Math.pow(2, Math.max(0, (detail.zoom ?? 14) - 12)))
					: cameraState.height;
				suppressCameraSync = true;
				needsTerrainSettle = true;
				void applyCameraPose(olCesium, cameraState, {
					animate: true,
					lonLat: [detail.lon, detail.lat],
					heightOverride: Math.min(cameraState.height, targetHeight),
					duration: 1.35
				});
				setTimeout(() => {
					suppressCameraSync = false;
				}, 1500);
			} else {
				view.animate({
					center,
					zoom: detail.zoom ?? 16,
					duration: 600
				});
			}
		};
		window.addEventListener("map:jump-to", onJump);

		const onCameraPoseEvent = (evt: Event) => {
			if (!olCesium || !olCesium.getEnabled()) return;
			const detail = (evt as CustomEvent<Partial<CameraState> & { animate?: boolean }>).detail ?? {};
			const current = getCameraState();
			const merged: CameraState = {
				heading: detail.heading !== undefined ? detail.heading : current.heading,
				pitch: detail.pitch !== undefined ? detail.pitch : current.pitch,
				height: detail.height !== undefined ? detail.height : current.height,
				setHeading: current.setHeading,
				setPitch: current.setPitch,
				setHeight: current.setHeight
			};
			suppressCameraSync = true;
			setCameraState({
				heading: merged.heading,
				pitch: merged.pitch,
				height: merged.height
			});
			void applyCameraPose(olCesium, merged, {
				animate: detail.animate ?? false,
				heightOverride: merged.height
			});
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
			}
			if (!olCesium) return;
			const scene = olCesium.getCesiumScene();

			if (state.enabled !== previous.enabled) {
				if (state.enabled) {
					setVectorAltitudeMode("clampToGround");
					enter3DBasemap();
				} else {
					setVectorAltitudeMode(undefined);
					leave3DBasemap();
				}
				olCesium.setEnabled(state.enabled);
				if (state.enabled) {
					try {
						if (
							vectorSync &&
							typeof vectorSync.destroyAll === "function" &&
							typeof vectorSync.synchronize === "function"
						) {
							vectorSync.destroyAll();
							vectorSync.synchronize();
						}
					} catch (err) {
						console.warn("[cesium] Failed to rebuild vector synchronizer", err);
					}
					needsTerrainSettle = true;
					void applyBestTerrainProvider(scene, state, abort);
					scene.requestRender();
					requestAnimationFrame(() => {
						const cameraState = getCameraState();
						suppressCameraSync = true;
						void applyCameraPose(olCesium as any, cameraState, { animate: true, duration: 1.3 });
						queueCesiumBasemapRebuild();
						void syncPhotorealisticMesh();
						setTimeout(() => {
							suppressCameraSync = false;
						}, 1500);
					});
				} else {
					void syncPhotorealisticMesh();
					clearCesiumBasemaps();
					try {
						map.getLayerGroup().setVisible(true);
					} catch {
						// ignore
					}
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
				state.terrariumUrl !== previous.terrariumUrl ||
				state.terrainSource !== previous.terrainSource
			) {
				void applyBestTerrainProvider(scene, state, abort);
			}
			if (state.sceneMode3D !== previous.sceneMode3D || state.enabled !== previous.enabled) {
				void syncPhotorealisticMesh();
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
				removePhotorealisticTileset(olCesium.getCesiumScene(), meshTileset);
				meshTileset = null;
			}
			window.removeEventListener("map:set-camera-pose", onCameraPoseEvent);
			window.removeEventListener("map:jump-to", onJump);
			setCesium(null);
			setMap(null);
			if (unsubscribeBasemap) unsubscribeBasemap();
			clearCesiumBasemaps();
			if (removeTileProgressListener) {
				try {
					removeTileProgressListener();
				} catch {
					// ignore
				}
			}
			if (removePreRenderListener) {
				try {
					removePreRenderListener();
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
