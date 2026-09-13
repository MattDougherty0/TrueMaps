import "dotenv/config";
import { app, BrowserWindow, dialog, ipcMain, protocol } from "electron";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
import * as fssync from "fs";
import { createReadStream } from "fs";
import { Readable } from "stream";
import { createHash } from "crypto";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require("pdfkit");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite3 = require("sqlite3");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegStatic = require("ffmpeg-static");
// Electron patches fs to look inside asar; child_process.spawn does not.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const originalFs: typeof fssync = process.versions.electron ? require("original-fs") : fssync;

let ffmpegBinaryPath: string | null | undefined;

function pathOutsideAsar(filePath: string): string {
	const packed = `${path.sep}app.asar${path.sep}`;
	const unpacked = `${path.sep}app.asar.unpacked${path.sep}`;
	if (filePath.includes(unpacked)) return filePath;
	if (filePath.includes(packed)) return filePath.replace(packed, unpacked);
	return filePath;
}

function isSpawnableBinary(filePath: string): boolean {
	if (!filePath) return false;
	const packed = `${path.sep}app.asar${path.sep}`;
	const unpacked = `${path.sep}app.asar.unpacked${path.sep}`;
	if (filePath.includes(packed) && !filePath.includes(unpacked)) return false;
	try {
		return originalFs.statSync(filePath).isFile();
	} catch {
		return false;
	}
}

function resolveFfmpegBinary(): string | null {
	const binaryName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
	const fromModule = typeof ffmpegStatic === "string" ? ffmpegStatic : "";
	const candidates = [
		path.join(process.resourcesPath || "", "bin", binaryName),
		fromModule ? pathOutsideAsar(fromModule) : "",
		fromModule
	].filter(Boolean);
	const seen = new Set<string>();
	for (const candidate of candidates) {
		if (seen.has(candidate)) continue;
		seen.add(candidate);
		if (isSpawnableBinary(candidate)) return candidate;
	}
	return null;
}

function ensureFfmpegConfigured(): string | null {
	if (ffmpegBinaryPath !== undefined) return ffmpegBinaryPath;
	const binary = resolveFfmpegBinary();
	if (!binary) {
		console.warn("[video] ffmpeg binary is not spawnable; conversion will be skipped");
		ffmpegBinaryPath = null;
		return null;
	}
	try {
		originalFs.chmodSync(binary, 0o755);
	} catch {
		// already executable, or chmod is not permitted
	}
	process.env.FFMPEG_PATH = binary;
	console.log("[video] using ffmpeg at", binary);
	ffmpegBinaryPath = binary;
	return binary;
}

// CRITICAL: Register custom protocol schemes BEFORE app is ready (must be synchronous)
protocol.registerSchemesAsPrivileged([
	{ scheme: "mbtiles", privileges: { standard: true, secure: true } },
	{
		scheme: "media",
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			stream: true,
			corsEnabled: true,
			bypassCSP: true
		}
	}
]);

const isDev = !app.isPackaged;
type MbtilesHandle = { db: any; format: string };
const mbtilesCache = new Map<string, MbtilesHandle>();
const TRANSPARENT_TILE = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=",
	"base64"
);
let activeProjectDir: string | null = null;
const activeTrailCameraImports = new Set<string>();
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
	win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
		console.error("Renderer failed to load", { errorCode, errorDescription, validatedURL });
	});

	if (isDev) {
		const url = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
		void win.loadURL(url);
		win.webContents.openDevTools({ mode: "detach" });
	} else {
		const indexPath = path.join(app.getAppPath(), "dist", "index.html");
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

function isPathInside(parent: string, child: string): boolean {
	const rel = path.relative(parent, child);
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function parseBytesRange(header: string | undefined, size: number): { start: number; end: number } | "unsatisfiable" | null {
	if (!header || size <= 0) return null;
	const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
	if (!match) return null;
	let start: number;
	let end: number;
	if (match[1] === "" && match[2] !== "") {
		const suffix = Number(match[2]);
		if (!Number.isFinite(suffix) || suffix <= 0) return "unsatisfiable";
		start = Math.max(0, size - suffix);
		end = size - 1;
	} else {
		start = match[1] === "" ? 0 : Number(match[1]);
		end = match[2] === "" ? size - 1 : Number(match[2]);
		if (!Number.isFinite(start) || !Number.isFinite(end)) return "unsatisfiable";
		end = Math.min(end, size - 1);
	}
	if (start < 0 || start >= size || end < start) return "unsatisfiable";
	return { start, end };
}

async function resolvedPathInside(parent: string, candidate: string): Promise<string | null> {
	try {
		const parentReal = await fs.realpath(parent);
		const candidateReal = await fs.realpath(candidate);
		return isPathInside(parentReal, candidateReal) ? candidateReal : null;
	} catch {
		return null;
	}
}

async function sha256File(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		const stream = createReadStream(filePath);
		stream.on("error", reject);
		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
	});
}

async function availableDestination(targetDir: string, fileName: string): Promise<string> {
	const parsed = path.parse(fileName);
	let candidate = path.join(targetDir, fileName);
	let suffix = 1;
	while (fssync.existsSync(candidate)) {
		candidate = path.join(targetDir, `${parsed.name}_${suffix}${parsed.ext}`);
		suffix += 1;
	}
	return candidate;
}

async function ensureDirectoryInsideBase(baseDir: string, relativePath: string): Promise<string> {
	const base = path.resolve(baseDir);
	await fs.mkdir(base, { recursive: true });
	const baseStat = await fs.lstat(base);
	if (baseStat.isSymbolicLink()) throw new Error("Media directory cannot be a symbolic link");

	const target = resolveInsideBase(base, relativePath);
	const relative = path.relative(base, target);
	let current = base;
	for (const segment of relative.split(path.sep).filter(Boolean)) {
		current = path.join(current, segment);
		try {
			const stat = await fs.lstat(current);
			if (stat.isSymbolicLink()) throw new Error("Media import path cannot contain symbolic links");
			if (!stat.isDirectory()) throw new Error("Media import path contains a file");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			await fs.mkdir(current);
		}
	}
	return target;
}

async function assertReadableMediaFile(sourceAbsolutePath: string): Promise<void> {
	let st;
	try {
		st = await fs.stat(sourceAbsolutePath);
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ENOENT") {
			throw new Error(
				"That file is not available. If it is in iCloud Photos, download it to this Mac first."
			);
		}
		throw error;
	}
	if (!st.isFile()) {
		throw new Error("TrueMap can only import regular photo and video files.");
	}
	if (sourceAbsolutePath.toLowerCase().endsWith(".icloud")) {
		throw new Error("That item is still in iCloud. Download it in Photos, then import again.");
	}
}

function runFfmpeg(binary: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		try {
			const proc = spawn(binary, args, { windowsHide: true });
			let stderr = "";
			proc.stderr?.on("data", (chunk) => {
				stderr += chunk.toString();
			});
			proc.on("error", (err) => reject(err));
			proc.on("close", (code) => {
				if (code === 0) resolve();
				else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
			});
		} catch (err) {
			reject(err);
		}
	});
}

async function convertVideoToMP4(inputPath: string, outputPath: string): Promise<void> {
	const binary = ensureFfmpegConfigured();
	if (!binary) {
		throw new Error("ffmpeg is not available in this installation");
	}
	console.log(`[video] Converting ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
	await runFfmpeg(binary, [
		"-y",
		"-i",
		inputPath,
		"-c:v",
		"libx264",
		"-preset",
		"fast",
		"-crf",
		"23",
		"-c:a",
		"aac",
		"-movflags",
		"+faststart",
		"-pix_fmt",
		"yuv420p",
		"-profile:v",
		"baseline",
		"-level",
		"3.0",
		outputPath
	]);
	console.log(`[video] ✓ Conversion complete: ${outputPath}`);
}

async function convertAviOrCopy(
	sourceAbsolutePath: string,
	destDir: string,
	originalName: string
): Promise<string> {
	const parsed = path.parse(originalName);
	const mp4Dest = await availableDestination(destDir, `${parsed.name}.mp4`);
	try {
		await convertVideoToMP4(sourceAbsolutePath, mp4Dest);
		return mp4Dest;
	} catch (err) {
		console.error("[video] Conversion failed, copying original:", err);
		try {
			await fs.unlink(mp4Dest);
		} catch {
			// conversion may not have created an output file
		}
		const fallback = await availableDestination(destDir, originalName);
		await fs.copyFile(sourceAbsolutePath, fallback);
		return fallback;
	}
}

async function importMediaFile(sourceAbsolutePath: string, destDir: string): Promise<string> {
	await assertReadableMediaFile(sourceAbsolutePath);
	await fs.mkdir(destDir, { recursive: true });
	const original = path.basename(sourceAbsolutePath);
	if (path.extname(original).toLowerCase() === ".avi") {
		return convertAviOrCopy(sourceAbsolutePath, destDir, original);
	}
	const destPath = await availableDestination(destDir, original);
	await fs.copyFile(sourceAbsolutePath, destPath);
	return destPath;
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
			const tilesDir = path.join(activeProjectDir, "tiles");
			let mbtilesPath = path.join(tilesDir, `${tileset}.mbtiles`);
			// Fallback: if requesting a property-specific tileset (e.g., hillshade_mckean)
			// but it doesn't exist, fall back to the base tileset (hillshade).
			if (!fssync.existsSync(mbtilesPath) && tileset.includes("_")) {
				const baseTileset = tileset.slice(0, tileset.lastIndexOf("_"));
				const fallbackPath = path.join(tilesDir, `${baseTileset}.mbtiles`);
				if (fssync.existsSync(fallbackPath)) {
					mbtilesPath = fallbackPath;
				}
			}
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
	protocol.handle("media", async (request) => {
		try {
			if (!activeProjectDir) {
				console.error("[media] No active project directory");
				return new Response("Not found", { status: 404 });
			}
			const url = new URL(request.url);
			let pathParts: string[] = [];
			if (url.hostname) {
				pathParts = [url.hostname, ...url.pathname.split("/").filter(Boolean)];
			} else if (url.pathname && url.pathname !== "/") {
				pathParts = url.pathname.split("/").filter(Boolean);
			} else {
				console.error(`[media] No path found in URL: ${request.url}`);
				return new Response("Bad request", { status: 400 });
			}

			const segments = pathParts.map((seg) => {
				try {
					return decodeURIComponent(seg);
				} catch {
					return seg;
				}
			});

			const relativePath = segments.join(path.sep);
			const fullPath = path.join(activeProjectDir, "media", relativePath);
			const mediaDir = path.resolve(activeProjectDir, "media");
			const resolvedPath = path.resolve(fullPath);

			if (!resolvedPath.startsWith(mediaDir)) {
				console.error(`[media] Path escape attempt: ${resolvedPath} not in ${mediaDir}`);
				return new Response("Forbidden", { status: 403 });
			}

			if (!fssync.existsSync(resolvedPath)) {
				console.error(`[media] File not found: ${resolvedPath}`);
				console.error(`[media] Active project dir: ${activeProjectDir}`);
				console.error(`[media] Media dir: ${mediaDir}`);
				console.error(`[media] Relative path: ${relativePath}`);
				return new Response("Not found", { status: 404 });
			}

			const ext = path.extname(resolvedPath).toLowerCase();
			const mimeTypes: Record<string, string> = {
				".jpg": "image/jpeg",
				".jpeg": "image/jpeg",
				".png": "image/png",
				".gif": "image/gif",
				".webp": "image/webp",
				".heic": "image/heic",
				".heif": "image/heif",
				".mp4": "video/mp4",
				".mov": "video/quicktime",
				".m4v": "video/x-m4v",
				".avi": "video/x-msvideo",
				".mkv": "video/x-matroska",
				".webm": "video/webm"
			};
			const mimeType = mimeTypes[ext] || "application/octet-stream";
			const stats = fssync.statSync(resolvedPath);
			const range = parseBytesRange(request.headers.get("range") ?? undefined, stats.size);

			if (range === "unsatisfiable") {
				return new Response(null, {
					status: 416,
					headers: {
						"Content-Type": mimeType,
						"Content-Range": `bytes */${stats.size}`,
						"Accept-Ranges": "bytes"
					}
				});
			}

			const start = range?.start ?? 0;
			const end = range?.end ?? Math.max(0, stats.size - 1);
			const chunkSize = stats.size === 0 ? 0 : end - start + 1;
			const statusCode = range ? 206 : 200;
			const nodeStream = createReadStream(resolvedPath, stats.size === 0 ? undefined : { start, end });
			request.signal.addEventListener("abort", () => nodeStream.destroy());
			console.log(`[media] ${statusCode} ${relativePath} ${mimeType} ${range ? `${start}-${end}/${stats.size}` : `${stats.size} bytes`}`);
			return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
				status: statusCode,
				headers: {
					"Content-Type": mimeType,
					"Content-Length": String(chunkSize),
					"Accept-Ranges": "bytes",
					...(range ? { "Content-Range": `bytes ${start}-${end}/${stats.size}` } : {})
				}
			});
		} catch (err) {
			console.error("[media] Protocol error:", err);
			if (err instanceof Error) {
				console.error("[media] Error stack:", err.stack);
			}
			return new Response("Error", { status: 500 });
		}
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
			const destPath = await importMediaFile(sourceAbsolutePath, targetDir);
			const relativeToProject = path.relative(baseDir, destPath).split(path.sep).join("/");
			console.log(`[media:copy] Returning relative path: ${relativeToProject} (destPath: ${destPath})`);
			return relativeToProject;
		}
	);

	ipcMain.handle(
		"media:hashExternalFiles",
		async (_event, absolutePaths: string[]): Promise<Array<{ path: string; sha256: string }>> => {
			const results: Array<{ path: string; sha256: string }> = [];
			for (const absolutePath of Array.isArray(absolutePaths) ? absolutePaths : []) {
				try {
					await assertReadableMediaFile(absolutePath);
					results.push({ path: absolutePath, sha256: await sha256File(absolutePath) });
				} catch (error) {
					console.warn("[media:hashExternalFiles] Failed to hash", absolutePath, error);
				}
			}
			return results;
		}
	);

	ipcMain.handle("media:resolvePath", async (_event, baseDir: string, relativePath: string) => {
		const target = resolveInsideBase(baseDir, relativePath);
		return target;
	});

	ipcMain.handle(
		"media:hashFiles",
		async (_event, baseDir: string, mediaPaths: string[]): Promise<Array<{ path: string; sha256: string }>> => {
			const mediaDir = path.resolve(baseDir, "media");
			const realMediaDir = await fs.realpath(mediaDir);
			const results: Array<{ path: string; sha256: string }> = [];
			for (const mediaPath of Array.isArray(mediaPaths) ? mediaPaths : []) {
				try {
					const target = resolveInsideBase(mediaDir, mediaPath);
					const realTarget = await fs.realpath(target);
					const relative = path.relative(realMediaDir, realTarget);
					if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
					const stat = await fs.lstat(realTarget);
					if (!stat.isFile()) continue;
					results.push({ path: mediaPath, sha256: await sha256File(realTarget) });
				} catch {
					// Missing legacy catalog entries are ignored rather than blocking an import.
				}
			}
			return results;
		}
	);

	ipcMain.handle("media:deleteFile", async (_event, absolutePath: string) => {
		try {
			await fs.unlink(absolutePath);
			return true;
		} catch {
			return false;
		}
	});

	ipcMain.handle(
		"media:deleteTrailCameraSource",
		async (
			_event,
			payload: {
				projectPath: string;
				sourceRoot: string;
				sourcePath?: string;
				sourceRelativePath?: string;
			}
		): Promise<{ deleted: boolean; status: "deleted" | "missing" | "unsafe" | "error" }> => {
			const projectPath = path.resolve(payload.projectPath || "");
			const sourceRoot = path.resolve(payload.sourceRoot || "");
			if (!projectPath || !sourceRoot) return { deleted: false, status: "unsafe" };

			let sourceRootReal: string;
			try {
				sourceRootReal = await fs.realpath(sourceRoot);
				const rootStat = await fs.stat(sourceRootReal);
				if (!rootStat.isDirectory()) return { deleted: false, status: "missing" };
			} catch {
				return { deleted: false, status: "missing" };
			}

			if (isPathInside(projectPath, sourceRootReal)) {
				return { deleted: false, status: "unsafe" };
			}

			const relative = (payload.sourceRelativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
			if (relative.includes("..")) return { deleted: false, status: "unsafe" };

			const candidates = [
				payload.sourcePath ? path.resolve(payload.sourcePath) : "",
				relative ? path.resolve(sourceRootReal, ...relative.split("/").filter(Boolean)) : ""
			].filter(Boolean);

			let target: string | null = null;
			for (const candidate of candidates) {
				target = await resolvedPathInside(sourceRootReal, candidate);
				if (target) break;
			}
			if (!target) return { deleted: false, status: "missing" };
			if (isPathInside(projectPath, target)) return { deleted: false, status: "unsafe" };

			try {
				const stat = await fs.lstat(target);
				if (!stat.isFile() || stat.isSymbolicLink()) return { deleted: false, status: "unsafe" };
				await fs.unlink(target);
				return { deleted: true, status: "deleted" };
			} catch (error) {
				const code = (error as NodeJS.ErrnoException).code;
				if (code === "ENOENT") return { deleted: false, status: "missing" };
				console.warn("[media:deleteTrailCameraSource] Failed to delete", target, error);
				return { deleted: false, status: "error" };
			}
		}
	);

	ipcMain.handle(
		"media:listFolder",
		async (_event, baseDir: string, relativeFolderPath: string): Promise<string[]> => {
			// relativeFolderPath is project-relative, e.g. "media/trail_cameras/cam_01"
			const mediaDir = path.resolve(baseDir, "media");
			const target = resolveInsideBase(baseDir, relativeFolderPath);
			const resolved = path.resolve(target);
			if (!resolved.startsWith(mediaDir)) {
				throw new Error("Folder must be inside project media/");
			}
			const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".mp4", ".mov", ".m4v", ".avi"]);
			const out: Array<{ rel: string; mtime: number }> = [];
			const walk = async (dirAbs: string) => {
				const entries = await fs.readdir(dirAbs, { withFileTypes: true } as any);
				for (const ent of entries as any[]) {
					const fp = path.join(dirAbs, ent.name);
					if (ent.isDirectory()) {
						await walk(fp);
						continue;
					}
					const ext = path.extname(ent.name).toLowerCase();
					if (!allowed.has(ext)) continue;
					try {
						const st = await fs.stat(fp);
						const rel = path.relative(baseDir, fp).split(path.sep).join("/");
						out.push({ rel, mtime: st.mtimeMs || 0 });
					} catch {
						// ignore
					}
				}
			};
			await walk(resolved);
			out.sort((a, b) => b.mtime - a.mtime);
			return out.slice(0, 500).map((e) => e.rel);
		}
	);

	ipcMain.handle(
		"media:importFolder",
		async (
			_event,
			baseDir: string,
			sourceDirAbsolutePath: string,
			targetFolderPath: string
		): Promise<{ folder: string; files: string[] }> => {
			// targetFolderPath is project-relative, e.g. "media/trail_cameras/cam_01"
			const mediaDir = path.resolve(baseDir, "media");
			const targetAbs = resolveInsideBase(baseDir, targetFolderPath);
			if (!path.resolve(targetAbs).startsWith(mediaDir)) {
				throw new Error("Target must be inside project media/");
			}
			await fs.mkdir(targetAbs, { recursive: true });
			const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"]);
			const copied: string[] = [];
			const walk = async (dirAbs: string) => {
				const entries = await fs.readdir(dirAbs, { withFileTypes: true } as any);
				for (const ent of entries as any[]) {
					const fp = path.join(dirAbs, ent.name);
					if (ent.isDirectory()) {
						await walk(fp);
						continue;
					}
					const ext = path.extname(ent.name).toLowerCase();
					if (!allowed.has(ext)) continue;
					try {
						const destAbs = await importMediaFile(fp, targetAbs);
						copied.push(path.relative(baseDir, destAbs).split(path.sep).join("/"));
					} catch (err) {
						console.warn("[media:importFolder] Failed to import", fp, err);
					}
				}
			};
			await walk(path.resolve(sourceDirAbsolutePath));
			return { folder: targetFolderPath, files: copied };
		}
	);

	ipcMain.handle(
		"media:importTrailCamera",
		async (
			event,
			baseDir: string,
			sourceDirAbsolutePath: string,
			targetFolderPath: string,
			knownHashes: string[]
		): Promise<{
			files: Array<{
				name: string;
				path: string;
				type: "image" | "video";
				sha256: string;
				size: number;
				capturedAt: string;
				sourcePath: string;
				sourceRelativePath: string;
			}>;
			skippedDuplicates: number;
			skippedUnsupported: number;
			failedFiles: string[];
			duplicateMatches: Array<{
				sha256: string;
				sourceName: string;
				sourceRelativePath: string;
			}>;
		}> => {
			const importKey = path.resolve(baseDir);
			if (activeTrailCameraImports.has(importKey)) {
				throw new Error("A trail camera folder import is already running for this project.");
			}
			activeTrailCameraImports.add(importKey);
			try {
			const mediaDir = path.resolve(baseDir, "media");
			const sourceDir = path.resolve(sourceDirAbsolutePath);
			const targetDir = await ensureDirectoryInsideBase(mediaDir, targetFolderPath);

			const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);
			const videoExts = new Set([".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"]);
			const known = new Set(Array.isArray(knownHashes) ? knownHashes.filter(Boolean) : []);
			const seenThisImport = new Set<string>();
			const sourceFiles: string[] = [];
			let skippedUnsupported = 0;

			const walk = async (dir: string) => {
				const entries = await fs.readdir(dir, { withFileTypes: true });
				for (const entry of entries) {
					const absolutePath = path.join(dir, entry.name);
					if (entry.isSymbolicLink()) {
						skippedUnsupported += 1;
						continue;
					}
					if (entry.isDirectory()) {
						await walk(absolutePath);
						continue;
					}
					const ext = path.extname(entry.name).toLowerCase();
					if (!imageExts.has(ext) && !videoExts.has(ext)) {
						skippedUnsupported += 1;
						continue;
					}
					sourceFiles.push(absolutePath);
				}
			};
			await walk(sourceDir);
			event.sender.send("media:importTrailCameraProgress", {
				processed: 0,
				total: sourceFiles.length,
				fileName: "",
				stage: "copying"
			});

			const imported: Array<{
				name: string;
				path: string;
				type: "image" | "video";
				sha256: string;
				size: number;
				capturedAt: string;
				sourcePath: string;
				sourceRelativePath: string;
			}> = [];
			const failedFiles: string[] = [];
			const duplicateMatches: Array<{
				sha256: string;
				sourceName: string;
				sourceRelativePath: string;
			}> = [];
			let skippedDuplicates = 0;

			let processed = 0;
			for (const sourcePath of sourceFiles) {
				try {
					await assertReadableMediaFile(sourcePath);
					const hash = await sha256File(sourcePath);
					const sourceRelativePath = path.relative(sourceDir, sourcePath).split(path.sep).join("/");
					if (known.has(hash) || seenThisImport.has(hash)) {
						skippedDuplicates += 1;
						duplicateMatches.push({
							sha256: hash,
							sourceName: path.basename(sourcePath),
							sourceRelativePath
						});
						processed += 1;
						event.sender.send("media:importTrailCameraProgress", {
							processed,
							total: sourceFiles.length,
							fileName: path.basename(sourcePath),
							stage: "duplicate"
						});
						continue;
					}
					seenThisImport.add(hash);

					const stat = await fs.stat(sourcePath);
					const parsed = path.parse(sourcePath);
					const isAvi = parsed.ext.toLowerCase() === ".avi";
					event.sender.send("media:importTrailCameraProgress", {
						processed,
						total: sourceFiles.length,
						fileName: parsed.base,
						stage: isAvi ? "converting" : "copying"
					});

					const destination = isAvi
						? await convertAviOrCopy(sourcePath, targetDir, parsed.base)
						: await importMediaFile(sourcePath, targetDir);

					const relativePath = path.relative(mediaDir, destination).split(path.sep).join("/");
					imported.push({
						name: path.basename(destination),
						path: relativePath,
						type: videoExts.has(parsed.ext.toLowerCase()) ? "video" : "image",
						sha256: hash,
						size: stat.size,
						capturedAt: stat.mtime.toISOString(),
						sourcePath,
						sourceRelativePath
					});
				} catch (error) {
					console.warn("[media:importTrailCamera] Failed to import", sourcePath, error);
					failedFiles.push(path.relative(sourceDir, sourcePath).split(path.sep).join("/"));
				}
				processed += 1;
				event.sender.send("media:importTrailCameraProgress", {
					processed,
					total: sourceFiles.length,
					fileName: path.basename(sourcePath),
					stage: "complete"
				});
			}

			return {
				files: imported,
				skippedDuplicates,
				skippedUnsupported,
				failedFiles,
				duplicateMatches
			};
			} finally {
				activeTrailCameraImports.delete(importKey);
			}
		}
	);

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
				"waypoints.geojson",
				"trail_cameras.geojson",
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

