export type MediaKind = "image" | "video";

export type MediaFingerprint = {
	type: MediaKind;
	sha256?: string;
	storedSha256?: string;
	payloadSha256?: string;
	originalName?: string;
	captureTime?: string;
	captureSubsec?: string;
	cameraMake?: string;
	cameraModel?: string;
	width?: number;
	height?: number;
};

export const hashesFor = (fp: Pick<MediaFingerprint, "sha256" | "storedSha256" | "payloadSha256">): string[] =>
	[fp.sha256, fp.storedSha256, fp.payloadSha256].filter((hash): hash is string => Boolean(hash));

export const normalizeOriginalName = (name: string): string => {
	const base = name.replace(/\.[^.]+$/, "").trim().toLowerCase();
	return base.replace(/(\s*\(\d+\))$/g, "").trim();
};

export const normalizeCaptureTime = (raw?: string): string | undefined => {
	if (!raw) return undefined;
	const trimmed = raw.trim();
	const exif = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(trimmed);
	if (exif) return `${exif[1]}-${exif[2]}-${exif[3]}T${exif[4]}:${exif[5]}:${exif[6]}`;
	const iso = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(trimmed);
	if (iso) return `${iso[1]}T${iso[2]}:${iso[3]}:${iso[4]}`;
	return undefined;
};

export const strongIdentityKey = (fp: MediaFingerprint): string | undefined => {
	const time = normalizeCaptureTime(fp.captureTime);
	const name = fp.originalName ? normalizeOriginalName(fp.originalName) : "";
	if (!time || !name || !fp.width || !fp.height) return undefined;
	return `s|${fp.type}|${name}|${time}|${fp.captureSubsec || ""}|${fp.width}x${fp.height}`;
};

export const looseIdentityKey = (fp: MediaFingerprint): string | undefined => {
	const time = normalizeCaptureTime(fp.captureTime);
	if (!time || !fp.width || !fp.height) return undefined;
	const make = (fp.cameraMake || "").trim().toLowerCase();
	const model = (fp.cameraModel || "").trim().toLowerCase();
	return `l|${fp.type}|${time}|${fp.captureSubsec || ""}|${make}|${model}|${fp.width}x${fp.height}`;
};

export const identityKeysFor = (fp: MediaFingerprint): string[] =>
	[strongIdentityKey(fp), looseIdentityKey(fp)].filter((key): key is string => Boolean(key));
