import { createHash } from "crypto";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
import { createReadStream } from "fs";
import {
	identityKeysFor,
	normalizeCaptureTime,
	type MediaFingerprint,
	type MediaKind
} from "./fingerprint";

export { hashesFor, identityKeysFor, type MediaFingerprint } from "./fingerprint";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"]);
const JPEG_EXTS = new Set([".jpg", ".jpeg"]);

export async function sha256File(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		const stream = createReadStream(filePath);
		stream.on("error", reject);
		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
	});
}

const mediaKindFor = (filePath: string): MediaKind | undefined => {
	const ext = path.extname(filePath).toLowerCase();
	if (IMAGE_EXTS.has(ext)) return "image";
	if (VIDEO_EXTS.has(ext)) return "video";
	return undefined;
};

const readU16 = (buf: Buffer, offset: number, le: boolean): number =>
	le ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);

const readU32 = (buf: Buffer, offset: number, le: boolean): number =>
	le ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);

const readExifString = (buf: Buffer, offset: number, size: number): string => {
	const end = Math.min(buf.length, offset + size);
	let text = buf.subarray(offset, end).toString("utf8");
	const nul = text.indexOf("\0");
	if (nul >= 0) text = text.slice(0, nul);
	return text.trim();
};

type ExifValues = {
	make?: string;
	model?: string;
	dateTimeOriginal?: string;
	dateTime?: string;
	subsec?: string;
	width?: number;
	height?: number;
};

const readExifIfd = (tiff: Buffer, ifdOffset: number, le: boolean, values: ExifValues): void => {
	if (ifdOffset < 0 || ifdOffset + 2 > tiff.length) return;
	const count = readU16(tiff, ifdOffset, le);
	let exifIfd = 0;
	for (let i = 0; i < count; i += 1) {
		const entry = ifdOffset + 2 + i * 12;
		if (entry + 12 > tiff.length) return;
		const tag = readU16(tiff, entry, le);
		const type = readU16(tiff, entry + 2, le);
		const size = readU32(tiff, entry + 4, le);
		const inline = entry + 8;
		const typeSize = type === 3 ? 2 : type === 4 || type === 9 ? 4 : 1;
		const byteLen = size * typeSize;
		const dataOffset = byteLen <= 4 ? inline : readU32(tiff, inline, le);
		const valueAt = byteLen <= 4 ? inline : dataOffset;
		if (valueAt < 0 || valueAt + Math.min(byteLen, 4) > tiff.length) continue;

		if (tag === 0x8769 && byteLen >= 4) {
			exifIfd = readU32(tiff, inline, le);
		} else if (tag === 0x010f) {
			values.make = readExifString(tiff, valueAt, byteLen);
		} else if (tag === 0x0110) {
			values.model = readExifString(tiff, valueAt, byteLen);
		} else if (tag === 0x9003) {
			values.dateTimeOriginal = readExifString(tiff, valueAt, byteLen);
		} else if (tag === 0x0132) {
			values.dateTime = readExifString(tiff, valueAt, byteLen);
		} else if (tag === 0x9291) {
			values.subsec = readExifString(tiff, valueAt, byteLen);
		} else if ((tag === 0xa002 || tag === 0x0100) && byteLen >= 2) {
			values.width = type === 3 ? readU16(tiff, valueAt, le) : readU32(tiff, valueAt, le);
		} else if ((tag === 0xa003 || tag === 0x0101) && byteLen >= 2) {
			values.height = type === 3 ? readU16(tiff, valueAt, le) : readU32(tiff, valueAt, le);
		}
	}
	if (exifIfd) readExifIfd(tiff, exifIfd, le, values);
};

const parseJpegExif = (buf: Buffer): ExifValues => {
	const values: ExifValues = {};
	let i = 2;
	while (i + 4 <= buf.length) {
		if (buf[i] !== 0xff) break;
		while (i < buf.length && buf[i] === 0xff) i += 1;
		if (i >= buf.length) break;
		const marker = buf[i++];
		if (marker === 0xda || marker === 0xd9) break;
		if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
		if (i + 2 > buf.length) break;
		const len = buf.readUInt16BE(i);
		const payload = i + 2;
		const end = i + len;
		if (len < 2 || end > buf.length) break;
		if (marker === 0xe1 && end - payload >= 14 && buf.subarray(payload, payload + 6).toString("ascii") === "Exif\0\0") {
			const tiff = buf.subarray(payload + 6, end);
			const le = tiff.toString("ascii", 0, 2) === "II";
			const magic = le ? tiff.readUInt16LE(2) : tiff.readUInt16BE(2);
			if (magic === 42) {
				const ifd0 = le ? tiff.readUInt32LE(4) : tiff.readUInt32BE(4);
				readExifIfd(tiff, ifd0, le, values);
			}
		}
		if (marker >= 0xc0 && marker <= 0xc3 && len >= 7) {
			values.height = values.height || buf.readUInt16BE(payload + 1);
			values.width = values.width || buf.readUInt16BE(payload + 3);
		}
		i = end;
	}
	return values;
};

export const jpegPayloadSha256 = (buf: Buffer): string | undefined => {
	if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return undefined;
	const hash = createHash("sha256");
	hash.update(buf.subarray(0, 2));
	let i = 2;
	while (i + 1 <= buf.length) {
		if (buf[i] !== 0xff) {
			hash.update(buf.subarray(i));
			break;
		}
		while (i < buf.length && buf[i] === 0xff) i += 1;
		if (i >= buf.length) break;
		const marker = buf[i++];
		if (marker === 0xd9) {
			hash.update(Buffer.from([0xff, 0xd9]));
			break;
		}
		if (marker === 0xda) {
			hash.update(Buffer.from([0xff, marker]));
			hash.update(buf.subarray(i));
			break;
		}
		if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			hash.update(Buffer.from([0xff, marker]));
			continue;
		}
		if (i + 2 > buf.length) break;
		const len = buf.readUInt16BE(i);
		const start = i - 2;
		const end = i + len;
		if (len < 2 || end > buf.length) break;
		const skip = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
		if (!skip) hash.update(buf.subarray(start, end));
		i = end;
	}
	return hash.digest("hex");
};

const parseFfmpegProbe = (stderr: string): { width?: number; height?: number; creationTime?: string } => {
	const size = /Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/.exec(stderr);
	const created = /creation_time\s*:\s*([0-9T:\-.Z]+)/.exec(stderr);
	return {
		width: size ? Number(size[1]) : undefined,
		height: size ? Number(size[2]) : undefined,
		creationTime: normalizeCaptureTime(created?.[1])
	};
};

export function probeMediaWithFfmpeg(
	ffmpegBinary: string,
	filePath: string
): Promise<{ width?: number; height?: number; creationTime?: string }> {
	return new Promise((resolve) => {
		try {
			const proc = spawn(ffmpegBinary, ["-hide_banner", "-i", filePath], { windowsHide: true });
			let stderr = "";
			proc.stderr?.on("data", (chunk) => {
				stderr += chunk.toString();
			});
			const finish = () => resolve(parseFfmpegProbe(stderr));
			proc.on("close", finish);
			proc.on("error", () => resolve({}));
		} catch {
			resolve({});
		}
	});
}

export async function inspectMediaFile(
	filePath: string,
	ffmpegBinary: string | null
): Promise<MediaFingerprint | null> {
	const type = mediaKindFor(filePath);
	if (!type) return null;
	const sha256 = await sha256File(filePath);
	const fingerprint: MediaFingerprint = {
		type,
		sha256,
		originalName: path.basename(filePath)
	};
	const ext = path.extname(filePath).toLowerCase();
	if (JPEG_EXTS.has(ext)) {
		try {
			const buf = await fs.readFile(filePath);
			fingerprint.payloadSha256 = jpegPayloadSha256(buf);
			const exif = parseJpegExif(buf);
			fingerprint.cameraMake = exif.make;
			fingerprint.cameraModel = exif.model;
			fingerprint.captureSubsec = exif.subsec;
			fingerprint.captureTime = normalizeCaptureTime(exif.dateTimeOriginal || exif.dateTime);
			fingerprint.width = exif.width;
			fingerprint.height = exif.height;
		} catch (error) {
			console.warn("[media] Failed to parse JPEG identity", filePath, error);
		}
	}
	if (ffmpegBinary && (type === "video" || !fingerprint.width)) {
		const probed = await probeMediaWithFfmpeg(ffmpegBinary, filePath);
		fingerprint.width = fingerprint.width || probed.width;
		fingerprint.height = fingerprint.height || probed.height;
		fingerprint.captureTime = fingerprint.captureTime || probed.creationTime;
	}
	return fingerprint;
}

export const fingerprintMatchesKnown = (
	fingerprint: MediaFingerprint,
	hashes: Set<string>,
	identityKeys: Set<string>
): boolean => {
	if ([fingerprint.sha256, fingerprint.storedSha256, fingerprint.payloadSha256].some((hash) => hash && hashes.has(hash))) {
		return true;
	}
	return identityKeysFor(fingerprint).some((key) => identityKeys.has(key));
};
