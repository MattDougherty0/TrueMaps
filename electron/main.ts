import "dotenv/config";
import { app, BrowserWindow, dialog, ipcMain, protocol } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import * as fssync from "fs";
import { createReadStream } from "fs";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require("pdfkit");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite3 = require("sqlite3");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpeg = require("fluent-ffmpeg");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegStatic = require("ffmpeg-static");

// Set ffmpeg path if available
if (ffmpegStatic) {
	ffmpeg.setFfmpegPath(ffmpegStatic);
}

// CRITICAL: Register custom protocol schemes BEFORE app is ready (must be synchronous)
protocol.registerSchemesAsPrivileged([
	{ scheme: "mbtiles", privileges: { standard: true, secure: true } },
	{ scheme: "media", privileges: { standard: true, secure: true } }
]);

const isDev = !app.isPackaged;
type MbtilesHandle = { db: any; format: string };
const mbtilesCache = new Map<string, MbtilesHandle>();
const TRANSPARENT_TILE = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=",
	"base64"
);
let activeProjectDir: string | null = null;
function createWindow(): void {
	const win = new BrowserWindow({
		width: 1280,
		height: 820,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false
		},
		show: false
	});

	win.on("ready-to-show", () => win.show());

	if (isDev) {
		const url = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
		void win.loadURL(url);
		win.webContents.openDevTools({ mode: "detach" });
	} else {
		const indexPath = path.join(__dirname, "../dist/index.html");
		void win.loadFile(indexPath);
	}
}

function resolveInsideBase(baseDir: string, relativePath: string): string {
	const base = path.resolve(baseDir);
	const target = path.resolve(baseDir, relativePath);
	const rel = path.relative(base, target);
	if (rel.startsWith("..") || path.isAbsolute(rel)) {
		throw new Error("Path escapes base directory");
	}
	return target;
}

async function convertVideoToMP4(inputPath: string, outputPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		ffmpeg(inputPath)
			.videoCodec("libx264")
			.audioCodec("aac")
			.outputOptions([
				"-preset", "fast",
				"-crf", "23",
				"-movflags", "+faststart", // Enable fast start for web playback
				"-pix_fmt", "yuv420p", // Ensure compatibility
				"-profile:v", "baseline", // Maximum compatibility
				"-level", "3.0"
			])
			.on("start", (commandLine: string) => {
				console.log(`[video] Converting: ${commandLine}`);
			})
			.on("progress", (progress: { percent?: number }) => {
				if (progress.percent !== undefined) {
					console.log(`[video] Conversion progress: ${Math.round(progress.percent)}%`);
				}
			})
			.on("end", () => {
				console.log(`[video] ✓ Conversion complete: ${outputPath}`);
				resolve();
			})
			.on("error", (err: Error) => {
				console.error(`[video] Conversion error:`, err);
				reject(err);
			})
			.save(outputPath);
	});
}

app.whenReady().then(() => {
	// Register custom protocols before creating window
	protocol.registerBufferProtocol("mbtiles", async (request, respond) => {
		try {
			if (!activeProjectDir) {
				respond({ statusCode: 404 });
				return;
			}
			const url = new URL(request.url);
				const pathParts = url.pathname.split("/").filter(Boolean);
				const tileset = url.hostname ? decodeURIComponent(url.hostname) : pathParts[0];
				if (!tileset || pathParts.length < 3) {
				respond({ statusCode: 400 });
				return;
			}
				const [zStr, xStr, yFile] = pathParts.slice(-3);
				const yStr = yFile.split(".")[0];
			const z = Number(zStr);
			const x = Number(xStr);
			const y = Number(yStr);
			if (Number.isNaN(z) || Number.isNaN(x) || Number.isNaN(y)) {
				respond({ statusCode: 400 });
				return;
			}
			const mbtilesPath = path.join(activeProjectDir, "tiles", `${tileset}.mbtiles`);
			if (!fssync.existsSync(mbtilesPath)) {
				respond({ statusCode: 404 });
				return;
			}
			const tile = await getMbtilesTile(mbtilesPath, z, x, y);
			if (tile?.data?.length) {
				const mimeType = tile.mimeType || "image/png";
				respond({ mimeType, data: tile.data });
			} else {
				respond({ mimeType: "image/png", data: TRANSPARENT_TILE });
			}
		} catch (err) {
			console.error("mbtiles error", err);
			respond({ statusCode: 500 });
		}
	});

	console.log("[media] Registering media protocol handler...");
	protocol.registerStreamProtocol("media", (request, callback) => {
		console.log("[media] Handler called! URL:", request.url);
		(async () => {
			try {
				if (!activeProjectDir) {
					console.error("[media] No active project directory");
					callback({ statusCode: 404 });
					return;
				}
				const url = new URL(request.url);
				console.log(`[media] Request URL: ${request.url}`);
				console.log(`[media] Parsed - hostname: "${url.hostname}", pathname: "${url.pathname}"`);
				
				// For media:// URLs, path can be in pathname (media:///path) or hostname+pathname (media://hostname/path)
				let pathParts: string[] = [];
				
				// If hostname exists, it's the first path segment (media://leacock/path)
				if (url.hostname) {
					// Path starts with hostname: media://leacock/Older%208/IMAG0156.jpg
					pathParts = [url.hostname, ...url.pathname.split("/").filter(Boolean)];
					console.log(`[media] Using hostname+pathname, parts:`, pathParts);
				} else if (url.pathname && url.pathname !== "/") {
					// Path is only in pathname: media:///Leacock/Albino/IMAG0007.jpg
					pathParts = url.pathname.split("/").filter(Boolean);
					console.log(`[media] Using pathname only, parts:`, pathParts);
				} else {
					console.error(`[media] No path found in URL`);
					callback({ statusCode: 400 });
					return;
				}
				
				// Decode each path segment separately (handles URL encoding like %2F, %20)
				const segments = pathParts.map(seg => {
					try {
						return decodeURIComponent(seg);
					} catch {
						return seg; // If decoding fails, use as-is
					}
				});
				
				const relativePath = segments.join(path.sep);
				const fullPath = path.join(activeProjectDir, "media", relativePath);
				
				console.log(`[media] Resolved path: ${fullPath}`);
				
				// Security: ensure path is within media directory
				const mediaDir = path.resolve(activeProjectDir, "media");
				const resolvedPath = path.resolve(fullPath);
				
				if (!resolvedPath.startsWith(mediaDir)) {
					console.error(`[media] Path escape attempt: ${resolvedPath} not in ${mediaDir}`);
					callback({ statusCode: 403 });
					return;
				}
				
				if (!fssync.existsSync(resolvedPath)) {
					console.error(`[media] File not found: ${resolvedPath}`);
					console.error(`[media] Active project dir: ${activeProjectDir}`);
					console.error(`[media] Media dir: ${mediaDir}`);
					console.error(`[media] Relative path: ${relativePath}`);
					callback({ statusCode: 404 });
					return;
				}
				
				// Determine MIME type
				const ext = path.extname(resolvedPath).toLowerCase();
				const mimeTypes: Record<string, string> = {
					".jpg": "image/jpeg",
					".jpeg": "image/jpeg",
					".png": "image/png",
					".gif": "image/gif",
					".webp": "image/webp",
					".mp4": "video/mp4",
					".mov": "video/quicktime",
					".avi": "video/x-msvideo",
					".mkv": "video/x-matroska",
					".webm": "video/webm"
				};
				const mimeType = mimeTypes[ext] || "application/octet-stream";
				
				// Use streaming for proper range request support (needed for video seeking)
				const fileStream = createReadStream(resolvedPath);
				const stats = fssync.statSync(resolvedPath);
				
				console.log(`[media] ✓ Serving: ${resolvedPath} (${mimeType}, ${stats.size} bytes)`);
				callback({
					statusCode: 200,
					headers: {
						"Content-Type": mimeType,
						"Content-Length": stats.size.toString(),
						"Accept-Ranges": "bytes"
					},
					data: fileStream
				});
			} catch (err) {
				console.error("[media] Protocol error:", err);
				if (err instanceof Error) {
					console.error("[media] Error stack:", err.stack);
				}
				callback({ statusCode: 500 });
			}
		})();
	});

	createWindow();

	ipcMain.on("project:setActivePath", (_event, baseDir: string) => {
		activeProjectDir = baseDir;
	});

	ipcMain.handle("dialog:chooseDirectory", async () => {
		const result = await dialog.showOpenDialog({
			properties: ["openDirectory", "createDirectory"]
		});
		return result.canceled ? null : result.filePaths[0];
	});

	ipcMain.handle(
		"dialog:chooseFile",
		async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
			const result = await dialog.showOpenDialog({
				properties: ["openFile"],
				filters: options?.filters
			});
			return result.canceled ? null : result.filePaths[0];
		}
	);

	ipcMain.handle(
		"dialog:chooseFiles",
		async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
			// Filter out "All Files" option - if it's selected, don't pass filters to allow all file types
			const filters = options?.filters?.filter(
				(f) => !(f.extensions.length === 1 && f.extensions[0] === "*")
			);
			const result = await dialog.showOpenDialog({
				properties: ["openFile", "multiSelections"],
				filters: filters && filters.length > 0 ? filters : undefined
			});
			return result.canceled ? [] : result.filePaths;
		}
	);

	ipcMain.handle("fs:readExternalFile", async (_event, absolutePath: string) => {
		return fs.readFile(absolutePath, "utf-8");
	});
	ipcMain.handle("fs:readTextFile", async (_event, baseDir: string, relativePath: string) => {
		const target = resolveInsideBase(baseDir, relativePath);
		return fs.readFile(target, "utf-8");
	});

	ipcMain.handle(
		"fs:writeTextFile",
		async (_event, baseDir: string, relativePath: string, content: string) => {
			const target = resolveInsideBase(baseDir, relativePath);
			await fs.mkdir(path.dirname(target), { recursive: true });
			await fs.writeFile(target, content, "utf-8");
			return true;
		}
	);
	ipcMain.handle(
		"fs:atomicWriteTextFile",
		async (_event, baseDir: string, relativePath: string, content: string) => {
			const target = resolveInsideBase(baseDir, relativePath);
			await fs.mkdir(path.dirname(target), { recursive: true });
			const tmp = `${target}.tmp-${Math.random().toString(36).slice(2, 9)}`;
			try {
				await fs.writeFile(tmp, content, "utf-8");
				// On POSIX, rename is atomic within the same filesystem
				await fs.rename(tmp, target);
				return true;
			} catch (err) {
				try {
					await fs.rm(tmp, { force: true });
				} catch {
					// ignore cleanup failure
				}
				throw err;
			}
		}
	);

	ipcMain.handle(
		"fs:writeBinaryFile",
		async (_event, baseDir: string, relativePath: string, base64Data: string) => {
			const target = resolveInsideBase(baseDir, relativePath);
			await fs.mkdir(path.dirname(target), { recursive: true });
			const buf = Buffer.from(base64Data, "base64");
			await fs.writeFile(target, buf);
			return true;
		}
	);

	ipcMain.handle(
		"media:copy",
		async (_event, baseDir: string, sourceAbsolutePath: string, targetFolderPath?: string): Promise<string> => {
			const mediaDir = path.resolve(baseDir, "media");
			const targetDir = targetFolderPath ? path.join(mediaDir, targetFolderPath) : mediaDir;
			await fs.mkdir(targetDir, { recursive: true });
			const original = path.basename(sourceAbsolutePath);
			const { name, ext } = path.parse(original);
			
			// Check if it's an .avi file that needs conversion
			const isAvi = ext.toLowerCase() === ".avi";
			const finalExt = isAvi ? ".mp4" : ext;
			const finalName = isAvi ? `${name}${finalExt}` : original;
			
			let destPath = path.join(targetDir, finalName);
			let i = 1;
			while (fssync.existsSync(destPath)) {
				const baseName = isAvi ? name : path.parse(original).name;
				destPath = path.join(targetDir, `${baseName}_${i}${finalExt}`);
				i += 1;
			}
			
			if (isAvi) {
				// Convert .avi to .mp4
				console.log(`[video] Converting .avi to .mp4: ${original} -> ${path.basename(destPath)}`);
				try {
					await convertVideoToMP4(sourceAbsolutePath, destPath);
				} catch (err) {
					console.error(`[video] Conversion failed:`, err);
					// If conversion fails, use original file with .avi extension
					const fallbackPath = path.join(targetDir, original);
					let fallbackDest = fallbackPath;
					let j = 1;
					while (fssync.existsSync(fallbackDest)) {
						fallbackDest = path.join(targetDir, `${name}_${j}${ext}`);
						j += 1;
					}
					console.log(`[video] Falling back to original file: ${fallbackDest}`);
					await fs.copyFile(sourceAbsolutePath, fallbackDest);
					destPath = fallbackDest;
				}
			} else {
				// Copy file as-is
				await fs.copyFile(sourceAbsolutePath, destPath);
			}
			
			const relativeToProject = path.relative(baseDir, destPath).split(path.sep).join("/");
			console.log(`[media:copy] Returning relative path: ${relativeToProject} (destPath: ${destPath})`);
			return relativeToProject;
		}
	);

	ipcMain.handle("media:resolvePath", async (_event, baseDir: string, relativePath: string) => {
		const target = resolveInsideBase(baseDir, relativePath);
		return target;
	});

	ipcMain.handle("media:deleteFile", async (_event, absolutePath: string) => {
		try {
			await fs.unlink(absolutePath);
			return true;
		} catch {
			return false;
		}
	});

	ipcMain.handle(
		"project:createStructure",
		async (_event, baseDir: string, projectName: string) => {
			const dirs = ["data", "tiles", "media", "exports"];
			for (const d of dirs) {
				await fs.mkdir(path.join(baseDir, d), { recursive: true });
			}

			const emptyFC = JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);
			const dataFiles = [
				"property_boundary.geojson",
				"trees_points.geojson",
				"tree_stands.geojson",
				"bedding_areas.geojson",
				"beds_points.geojson",
				"open_woods.geojson",
				"cover_points.geojson",
				"acorn_flats.geojson",
				"mast_check_points.geojson",
				"big_rocks.geojson",
				"cliffs.geojson",
				"ravines.geojson",
				"streams.geojson",
				"trails.geojson",
				"scrapes.geojson",
				"rubs.geojson",
				"stands.geojson",
				"hunts.geojson",
				"harvests.geojson",
				"animal_sightings.geojson",
				"animal_paths.geojson",
				"animal_sign.geojson"
			];
			for (const f of dataFiles) {
				await fs.writeFile(path.join(baseDir, "data", f), emptyFC, "utf-8");
			}

			const projectJson = {
				name: projectName,
				crs: { code: "", utmZone: 0, isNorthern: true },
				users: [],
				style: {}
			};
			await fs.writeFile(
				path.join(baseDir, "project.json"),
				JSON.stringify(projectJson, null, 2),
				"utf-8"
			);

			// Seed default tiles if bundled versions exist
			try {
				const templateTileNames = [
					"hillshade.mbtiles",
					"slope.mbtiles",
					"contours.geojson",
					"topo.mbtiles",
					"aerial.mbtiles"
				];
				const appTilesDir = path.resolve(__dirname, "../tiles");
				for (const name of templateTileNames) {
					const sourcePath = path.join(appTilesDir, name);
					const destPath = path.join(baseDir, "tiles", name);
					if (fssync.existsSync(sourcePath) && !fssync.existsSync(destPath)) {
						await fs.copyFile(sourcePath, destPath);
					}
				}
			} catch (seedErr) {
				console.warn("Failed to seed default tiles:", seedErr);
			}

			return true;
		}
	);

	ipcMain.handle(
		"print:pdf",
		async (
			_event,
			baseDir: string,
			payload: {
				imageBase64: string;
				imageWidth: number;
				imageHeight: number;
				preset: string;
				timeWindow: string;
				scaleMeters: number;
				scaleLabel: string;
				timestamp: string;
			}
		) => {
			const { imageBase64, imageWidth, imageHeight, preset, timeWindow, scaleMeters, scaleLabel, timestamp } =
				payload;
			const imgBuffer = Buffer.from(imageBase64, "base64");
			const doc = new PDFDocument({ size: "LETTER", margin: 36 });
			const chunks: Buffer[] = [];
			doc.on("data", (c: Buffer) => chunks.push(c));
			const finished = new Promise<Buffer>((resolve) => {
				doc.on("end", () => resolve(Buffer.concat(chunks)));
			});
			doc.fontSize(14).text("TRUE MAP", { align: "left" });
			doc.moveDown(0.5);
			doc.fontSize(10).text(`Preset: ${preset}   Time: ${timeWindow}   ${timestamp}`);
			doc.moveDown(0.5);
			// place map image, fit into page width
			const maxW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
			const maxH = doc.page.height - 220; // leave room for legend
			doc.image(imgBuffer, {
				fit: [maxW, maxH],
				align: "center"
			});
			// North arrow
			const arrowX = doc.page.width - doc.page.margins.right - 40;
			const arrowY = doc.page.margins.top + 20;
			doc.save();
			doc.fontSize(12).text("N", arrowX + 10, arrowY - 14);
			doc.moveTo(arrowX + 12, arrowY).lineTo(arrowX + 12, arrowY + 30).stroke();
			doc.moveTo(arrowX + 12, arrowY).lineTo(arrowX + 6, arrowY + 8).stroke();
			doc.moveTo(arrowX + 12, arrowY).lineTo(arrowX + 18, arrowY + 8).stroke();
			doc.restore();
			// Scale bar (simple)
			doc.moveDown(1);
			const scaleLeft = doc.page.margins.left;
			const barWidth = Math.max(60, Math.min(200, (scaleMeters / 100) * 20)); // heuristic
			const barY = doc.y + 10;
			doc.rect(scaleLeft, barY, barWidth, 6).fill("#333333");
			doc.fillColor("#000").fontSize(9).text(scaleLabel, scaleLeft + barWidth + 6, barY - 2);
			doc.moveDown(2);
			doc.fontSize(11).text("Legend: Trails, Hunts, Sightings, Animal Paths, Property Boundary");
			doc.end();
			const buffer = await finished;
			const rel = `exports/map_${timestamp}.pdf`;
			await fs.writeFile(path.join(baseDir, rel), buffer);
			return rel;
		}
	);

	ipcMain.handle("export:gpkg", async (_event, baseDir: string) => {
		try {
			const ts = new Date().toISOString().replace(/[:.]/g, "-");
			const rel = `exports/true-map_${ts}.gpkg`;
			const abs = path.join(baseDir, rel);
			await fs.mkdir(path.dirname(abs), { recursive: true });
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const gpkgApi = require("@ngageoint/geopackage");
			const GeoPackageAPI = gpkgApi.GeoPackageAPI || gpkgApi;
			const gpkg = await GeoPackageAPI.create(abs);
			// load all data/*.geojson files
			const dataDir = path.join(baseDir, "data");
			const files = await fs.readdir(dataDir);
			for (const file of files) {
				if (!file.endsWith(".geojson")) continue;
				const table = file.replace(".geojson", "");
				try {
					const text = await fs.readFile(path.join(dataDir, file), "utf-8");
					const geojson = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
					if ((geojson.features || []).length === 0) continue;
					if (GeoPackageAPI.addGeoJSONFeaturesToGeoPackage) {
						await GeoPackageAPI.addGeoJSONFeaturesToGeoPackage(gpkg, table, geojson);
					} else if (gpkg.addGeoJSONFeaturesToGeoPackage) {
						await gpkg.addGeoJSONFeaturesToGeoPackage(table, geojson);
					}
				} catch {
					// skip problematic file
				}
			}
			if (gpkg?.close) await gpkg.close();
			return rel;
		} catch {
			return null;
		}
	});
	// Open a file using the OS default application
	ipcMain.handle("os:openPath", async (_event, absolutePath: string) => {
		try {
			const { shell } = require("electron");
			const result: string = await shell.openPath(absolutePath);
			// openPath returns empty string on success, otherwise an error message
			return !result;
		} catch {
			return false;
		}
	});
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("will-quit", () => {
	for (const handle of mbtilesCache.values()) {
		try {
			handle.db.close();
		} catch (err) {
			console.error("Error closing MBTiles db", err);
		}
	}
	mbtilesCache.clear();
});

async function getMbtilesHandle(filePath: string): Promise<MbtilesHandle> {
	if (mbtilesCache.has(filePath)) {
		return mbtilesCache.get(filePath) as MbtilesHandle;
	}
	const handle = await new Promise<MbtilesHandle>((resolve, reject) => {
		const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err: unknown) => {
			if (err) {
				reject(err);
				return;
			}
			db.get(
				"SELECT value FROM metadata WHERE name = 'format'",
				(err2: unknown, row: { value?: string } | undefined) => {
					if (err2) {
						reject(err2);
						return;
					}
					const format = (row?.value || "png").toLowerCase();
					resolve({ db, format });
				}
			);
		});
	});
	mbtilesCache.set(filePath, handle);
	return handle;
}

async function getMbtilesTile(
	filePath: string,
	z: number,
	x: number,
	y: number
): Promise<{ data: Buffer; mimeType: string } | null> {
	try {
		const handle = await getMbtilesHandle(filePath);
		const db = handle.db;
		const tmsY = Math.pow(2, z) - 1 - y;
		return await new Promise((resolve, reject) => {
			db.get(
				"SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
				[z, x, tmsY],
				(err: unknown, row: { tile_data?: Buffer } | undefined) => {
					if (err) {
						reject(err);
						return;
					}
					if (!row?.tile_data) {
						resolve(null);
						return;
					}
					const mimeType =
						handle.format === "jpg" || handle.format === "jpeg"
							? "image/jpeg"
							: handle.format === "webp"
							? "image/webp"
							: handle.format === "pbf"
							? "application/x-protobuf"
							: "image/png";
					resolve({ data: row.tile_data, mimeType });
				}
			);
		});
	} catch (err) {
		console.error("Failed to read MBTiles", err);
		return null;
	}
}

