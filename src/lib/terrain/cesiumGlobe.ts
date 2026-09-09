import {
	ArcGisBaseMapType,
	ArcGisMapServerImageryProvider,
	Cartesian3,
	Cesium3DTileset,
	CesiumTerrainProvider,
	Color,
	Credit,
	createWorldImageryAsync,
	createWorldTerrainAsync,
	DirectionalLight,
	EllipsoidTerrainProvider,
	Ion,
	IonWorldImageryStyle,
	Math as CesiumMath,
	Matrix4,
	OpenStreetMapImageryProvider,
	Transforms,
	WebMercatorTilingScheme,
	type ImageryLayer,
	type ImageryProvider
} from "cesium";
import type { TerrainState } from "../../state/terrain";
import TerrariumTerrainProvider from "./TerrariumProvider";

/** Google Photorealistic 3D Tiles on Cesium Ion. */
export const ION_GOOGLE_MESH_ASSET = 2275207;

const USGS_TOPO =
	"https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer";
const USGS_IMAGERY =
	"https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer";

export function setIonToken(token?: string) {
	if (token) {
		Ion.defaultAccessToken = token;
	}
}

export function configureGlobeScene(scene: any) {
	const globe = scene.globe;
	globe.enableLighting = true;
	globe.dynamicAtmosphereLighting = false;
	globe.showGroundAtmosphere = true;
	globe.showSkirts = true;
	globe.depthTestAgainstTerrain = false;
	globe.maximumScreenSpaceError = 1.0;
	globe.tileCacheSize = 250;
	globe.baseColor = Color.fromCssColorString("#243024");
	globe.lambertDiffuseMultiplier = 0.55;
	globe.lightingFadeOutDistance = 5.0e6;
	globe.lightingFadeInDistance = 1.2e7;
	globe.nightFadeOutDistance = 1.0e8;
	globe.nightFadeInDistance = 2.0e8;
	if (typeof globe.preloadAncestors === "boolean") globe.preloadAncestors = true;
	if (typeof globe.preloadSiblings === "boolean") globe.preloadSiblings = true;

	scene.highDynamicRange = false;
	scene.requestRenderMode = false;
	scene.fog.enabled = true;
	scene.fog.density = 0.00018;
	scene.fog.minimumBrightness = 0.35;

	const controller = scene.screenSpaceCameraController;
	controller.enableTilt = true;
	controller.enableCollisionDetection = true;
	controller.minimumZoomDistance = 15;
	controller.maximumZoomDistance = 20_000_000;
	controller.inertiaSpin = 0.92;
	controller.inertiaTranslate = 0.9;
	controller.inertiaZoom = 0.85;
	controller.minimumPitch = CesiumMath.toRadians(-89.5);
}

/**
 * Late-afternoon southwest sun in local ENU so 3D never goes dark at night
 * and ridges read the way they do on a hunting-season afternoon.
 */
export function applyHuntingLight(scene: any, lon: number, lat: number) {
	if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
	const origin = Cartesian3.fromDegrees(lon, lat);
	const enu = Transforms.eastNorthUpToFixedFrame(origin);
	const azimuth = CesiumMath.toRadians(228);
	const elevation = CesiumMath.toRadians(30);
	const sunLocal = new Cartesian3(
		Math.sin(azimuth) * Math.cos(elevation),
		Math.cos(azimuth) * Math.cos(elevation),
		Math.sin(elevation)
	);
	const emitLocal = Cartesian3.negate(sunLocal, new Cartesian3());
	const emitWorld = Matrix4.multiplyByPointAsVector(enu, emitLocal, new Cartesian3());
	Cartesian3.normalize(emitWorld, emitWorld);

	if (scene.light instanceof DirectionalLight) {
		Cartesian3.clone(emitWorld, scene.light.direction);
		scene.light.intensity = 1.45;
	} else {
		scene.light = new DirectionalLight({
			direction: emitWorld,
			intensity: 1.45,
			color: Color.fromCssColorString("#fff1d6")
		});
	}
}

export async function createWorldTerrainProvider() {
	return createWorldTerrainAsync({
		requestVertexNormals: true,
		requestWaterMask: false
	});
}

export async function applyBestTerrainProvider(
	scene: any,
	state: TerrainState,
	abort: { cancelled: boolean }
): Promise<string> {
	setIonToken(state.ionToken);

	const attach = async (provider: unknown, label: string) => {
		if (abort.cancelled) return label;
		scene.terrainProvider = provider as any;
		scene.requestRender?.();
		console.info(`[terrain] ${label}`);
		return label;
	};

	try {
		if (state.terrainUrl) {
			const provider = await CesiumTerrainProvider.fromUrl(state.terrainUrl, {
				requestVertexNormals: true,
				requestWaterMask: false
			});
			return attach(provider, `Custom terrain URL ${state.terrainUrl}`);
		}

		if (state.terrainSource === "local" && state.terrainAssetId && state.ionToken) {
			try {
				const provider = await CesiumTerrainProvider.fromIonAssetId(state.terrainAssetId, {
					requestVertexNormals: true,
					requestWaterMask: false
				});
				return attach(provider, `Local Ion DEM ${state.terrainAssetId}`);
			} catch (error) {
				console.warn("[terrain] Local DEM failed; using Cesium World Terrain.", error);
			}
		}

		if (state.ionToken) {
			const provider = await createWorldTerrainProvider();
			return attach(provider, "Cesium World Terrain (USGS 3DEP)");
		}

		if (state.terrariumUrl) {
			const provider = new TerrariumTerrainProvider({ urlTemplate: state.terrariumUrl });
			return attach(provider, "Terrarium ~30 m fallback");
		}

		return attach(new EllipsoidTerrainProvider(), "Ellipsoid (no elevation data)");
	} catch (error) {
		console.error("[terrain] Provider setup failed", error);
		if (state.ionToken && !abort.cancelled) {
			try {
				const provider = await createWorldTerrainProvider();
				return attach(provider, "Cesium World Terrain (fallback)");
			} catch (fallbackError) {
				console.error("[terrain] World Terrain fallback failed", fallbackError);
			}
		}
		if (state.terrariumUrl && !abort.cancelled) {
			const provider = new TerrariumTerrainProvider({ urlTemplate: state.terrariumUrl });
			return attach(provider, "Terrarium fallback");
		}
		return attach(new EllipsoidTerrainProvider(), "Ellipsoid fallback");
	}
}

async function usgsProvider(url: string, credit: string, maximumLevel: number) {
	return (await ArcGisMapServerImageryProvider.fromUrl(url, {
		maximumLevel,
		usePreCachedTilesIfAvailable: true,
		tilingScheme: new WebMercatorTilingScheme(),
		credit: new Credit(credit)
	} as any)) as unknown as ImageryProvider;
}

export async function createAerialImageryProvider(ionToken?: string): Promise<ImageryProvider> {
	if (ionToken) {
		try {
			return await createWorldImageryAsync({ style: IonWorldImageryStyle.AERIAL });
		} catch (error) {
			console.warn("[cesium] Bing aerial failed, trying Esri.", error);
		}
	}
	try {
		return (await ArcGisMapServerImageryProvider.fromBasemapType(
			ArcGisBaseMapType.SATELLITE
		)) as unknown as ImageryProvider;
	} catch (error) {
		console.warn("[cesium] Esri satellite failed, trying USGS imagery.", error);
	}
	return usgsProvider(USGS_IMAGERY, "USGS Imagery", 17);
}

export async function createTopoImageryProvider(): Promise<ImageryProvider> {
	return usgsProvider(USGS_TOPO, "USGS Topographic Map", 16);
}

export function styleTopoOverlayLayer(layer: ImageryLayer) {
	layer.alpha = 0.72;
	layer.saturation = 0.12;
	layer.gamma = 0.72;
	layer.brightness = 1.05;
	layer.colorToAlpha = Color.fromBytes(248, 244, 230, 255);
	layer.colorToAlphaThreshold = 0.38;
}

export function styleAerialLayer(layer: ImageryLayer) {
	layer.brightness = 1.12;
	layer.contrast = 1.06;
	layer.saturation = 1.05;
}

export function clearGlobeImagery(scene: any) {
	const layers = scene.imageryLayers;
	for (let i = layers.length - 1; i >= 0; i -= 1) {
		try {
			layers.remove(layers.get(i), true);
		} catch {
			// ignore
		}
	}
}

export async function createOsmFallbackProvider(): Promise<ImageryProvider> {
	return new OpenStreetMapImageryProvider({
		url: "https://tile.openstreetmap.org/"
	});
}

export async function loadPhotorealisticTileset(scene: any): Promise<Cesium3DTileset | null> {
	try {
		const tileset = await Cesium3DTileset.fromIonAssetId(ION_GOOGLE_MESH_ASSET, {
			maximumScreenSpaceError: 4
		});
		scene.primitives.add(tileset);
		scene.requestRender?.();
		console.info("[cesium] Photorealistic 3D tiles added.");
		return tileset;
	} catch (error) {
		console.warn("[cesium] Photorealistic 3D tiles failed.", error);
		return null;
	}
}

export function removePhotorealisticTileset(scene: any, tileset: Cesium3DTileset | null) {
	if (!tileset) return;
	try {
		scene.primitives.remove(tileset);
		if (typeof (tileset as any).destroy === "function" && !(tileset as any).isDestroyed?.()) {
			(tileset as any).destroy();
		}
	} catch (error) {
		console.warn("[cesium] Failed to remove photorealistic tileset", error);
	}
}
