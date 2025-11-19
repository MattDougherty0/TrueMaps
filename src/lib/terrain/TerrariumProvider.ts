import {
	Credit,
	Event as CesiumEvent,
	HeightmapTerrainData,
	Resource,
	TerrainProvider,
	WebMercatorTilingScheme,
	type Request
} from "cesium";

type TerrariumProviderOptions = {
	urlTemplate?: string;
	credit?: string;
	minimumLevel?: number;
	maximumLevel?: number;
	cacheSize?: number;
};

const DEFAULT_TEMPLATE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TILE_SIZE = 256;
const DEFAULT_MAX_LEVEL = 15;
const PIXEL_STRIDE = 4; // rgba

type CachedTileKey = `${number}:${number}:${number}`;

export default class TerrariumTerrainProvider extends TerrainProvider {
	readonly tilingScheme: WebMercatorTilingScheme;
	readonly errorEvent: CesiumEvent;
	readonly credit: Credit | undefined;
	readonly hasWaterMask = false;
	readonly hasVertexNormals = false;
	readonly ready = true;

	private readonly urlTemplate: string;
	private readonly minimumLevel: number;
	private readonly maximumLevel: number;
	private readonly tileWidth: number;
	private readonly tileHeight: number;
	private readonly levelZeroError: number;
	private readonly cache: Map<CachedTileKey, Promise<HeightmapTerrainData>>;
	private readonly maxCacheEntries: number;
	private readonly canvas: HTMLCanvasElement;
	private readonly context: CanvasRenderingContext2D;

	constructor(options: TerrariumProviderOptions = {}) {
		super();
		this.tilingScheme = new WebMercatorTilingScheme();
		this.errorEvent = new CesiumEvent();
		this.credit = options.credit ? new Credit(options.credit) : new Credit("Mapzen Terrain (AWS)");
		this.urlTemplate = options.urlTemplate?.trim().length ? options.urlTemplate : DEFAULT_TEMPLATE;
		this.minimumLevel = Math.max(0, options.minimumLevel ?? 0);
		this.maximumLevel = Math.max(this.minimumLevel, options.maximumLevel ?? DEFAULT_MAX_LEVEL);
		this.tileWidth = TILE_SIZE;
		this.tileHeight = TILE_SIZE;
		this.levelZeroError = TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
			this.tilingScheme.ellipsoid,
			this.tileWidth,
			this.tileHeight
		);
		this.cache = new Map();
		this.maxCacheEntries = Math.max(32, options.cacheSize ?? 256);
		this.canvas = document.createElement("canvas");
		this.canvas.width = this.tileWidth;
		this.canvas.height = this.tileHeight;
		const context = this.canvas.getContext("2d");
		if (!context) {
			throw new Error("Unable to get 2D context for terrain decoding");
		}
		this.context = context;
	}

	isDestroyed(): boolean {
		return false;
	}

	destroy(): void {
		this.cache.clear();
		this.context.clearRect(0, 0, this.tileWidth, this.tileHeight);
	}

	getLevelMaximumGeometricError(level: number): number {
		return this.levelZeroError / Math.pow(2, level);
	}

	async requestTileGeometry(
		x: number,
		y: number,
		level: number,
		request?: Request
	): Promise<HeightmapTerrainData | undefined> {
		if (level < this.minimumLevel || level > this.maximumLevel) {
			return undefined;
		}
		const cacheKey = `${level}:${x}:${y}` as CachedTileKey;
		const cached = this.cache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const promise = this.fetchAndDecodeTile(x, y, level, request)
			.then((data) => {
				this.pruneCache(cacheKey);
				return data;
			})
			.catch((error) => {
				this.cache.delete(cacheKey);
				this.errorEvent.raiseEvent(error);
				return undefined;
			});

		this.cache.set(cacheKey, promise);
		return promise;
	}

	getTileDataAvailable(): boolean {
		return true;
	}

	private pruneCache(retainedKey: CachedTileKey) {
		if (this.cache.size <= this.maxCacheEntries) return;
		for (const key of this.cache.keys()) {
			if (key === retainedKey) continue;
			this.cache.delete(key);
			if (this.cache.size <= this.maxCacheEntries) break;
		}
	}

	private async fetchAndDecodeTile(
		x: number,
		y: number,
		level: number,
		request?: Request
	): Promise<HeightmapTerrainData> {
		const url = this.urlTemplate
			.replace("{z}", String(level))
			.replace("{x}", String(x))
			.replace("{y}", String(y));

		const resource = new Resource({
			url,
			request
		});

		const image = await resource.fetchImage({ preferBlob: true });
		const width = image.width ?? this.tileWidth;
		const height = image.height ?? this.tileHeight;
		if (width !== this.tileWidth || height !== this.tileHeight) {
			this.canvas.width = width;
			this.canvas.height = height;
		}

		this.context.clearRect(0, 0, width, height);
		this.context.drawImage(image as HTMLImageElement | ImageBitmap, 0, 0, width, height);
		if ("close" in image && typeof image.close === "function") {
			(image as ImageBitmap).close();
		}

		const pixels = this.context.getImageData(0, 0, width, height).data;
		const length = width * height;
		const buffer = new Float32Array(length);

		for (let i = 0, j = 0; i < length; i += 1, j += PIXEL_STRIDE) {
			const r = pixels[j];
			const g = pixels[j + 1];
			const b = pixels[j + 2];
			const heightMeters = r * 256 + g + b / 256 - 32768;
			buffer[i] = heightMeters;
		}

		return new HeightmapTerrainData({
			width,
			height,
			childTileMask: 15,
			structure: {
				heightScale: 1,
				heightOffset: 0,
				elementsPerHeight: 1,
				stride: 1,
				elementMultiplier: 1,
				isBigEndian: false
			},
			buffer,
			skirtHeight: Math.max(20, this.getLevelMaximumGeometricError(level) * 0.5)
		});
	}
}


