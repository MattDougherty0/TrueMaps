import type { MediaFile } from "../../state/media";

/** Same-trigger cluster: 2 stills + a video are usually well under this. */
export const BURST_WINDOW_MS = 45_000;

export const captureTimeMs = (file: MediaFile): number => {
	const iso = file.capturedAt || file.createdAt;
	const time = Date.parse(iso);
	return Number.isNaN(time) ? 0 : time;
};

export const localDateKey = (file: MediaFile): string => {
	const time = captureTimeMs(file);
	if (!time) return "unknown";
	const date = new Date(time);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export const formatLocalDate = (key: string): string => {
	if (key === "unknown") return "Unknown date";
	const date = new Date(`${key}T12:00:00`);
	if (Number.isNaN(date.getTime())) return "Unknown date";
	return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export type DateGroup = {
	key: string;
	label: string;
	files: MediaFile[];
};

export const groupFilesByDate = (files: MediaFile[]): DateGroup[] => {
	const groups = new Map<string, MediaFile[]>();
	for (const file of files) {
		const key = localDateKey(file);
		const list = groups.get(key);
		if (list) list.push(file);
		else groups.set(key, [file]);
	}
	return [...groups.entries()]
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([key, grouped]) => ({
			key,
			label: formatLocalDate(key),
			files: [...grouped].sort((a, b) => captureTimeMs(a) - captureTimeMs(b))
		}));
};

export type MediaBurst = {
	id: string;
	files: MediaFile[];
};

export const burstSummary = (files: MediaFile[]): string => {
	const photos = files.filter((file) => file.type === "image").length;
	const videos = files.filter((file) => file.type === "video").length;
	const parts: string[] = [];
	if (photos) parts.push(`${photos} photo${photos === 1 ? "" : "s"}`);
	if (videos) parts.push(`${videos} video${videos === 1 ? "" : "s"}`);
	if (!parts.length) parts.push(`${files.length} file${files.length === 1 ? "" : "s"}`);
	return parts.join(" · ");
};

export const preferredBurstFileIndex = (files: MediaFile[]): number => {
	const imageIndex = files.findIndex((file) => file.type === "image");
	return imageIndex >= 0 ? imageIndex : 0;
};

export const groupIntoBursts = (files: MediaFile[], windowMs = BURST_WINDOW_MS): MediaBurst[] => {
	const bySite = new Map<string, MediaFile[]>();
	for (const file of files) {
		const siteKey = file.cameraSiteId || "__unassigned__";
		const list = bySite.get(siteKey);
		if (list) list.push(file);
		else bySite.set(siteKey, [file]);
	}

	const clusters: MediaFile[][] = [];
	for (const siteFiles of bySite.values()) {
		const chronological = [...siteFiles].sort(
			(a, b) => captureTimeMs(a) - captureTimeMs(b) || a.id.localeCompare(b.id)
		);
		let current: MediaFile[] | null = null;
		for (const file of chronological) {
			if (!current) {
				current = [file];
				continue;
			}
			const previous = current[current.length - 1];
			if (captureTimeMs(file) - captureTimeMs(previous) <= windowMs) {
				current.push(file);
			} else {
				clusters.push(current);
				current = [file];
			}
		}
		if (current) clusters.push(current);
	}

	return clusters
		.sort((a, b) => captureTimeMs(b[b.length - 1]) - captureTimeMs(a[a.length - 1]))
		.map((group) => ({
			id: group.map((file) => file.id).join("|"),
			files: group
		}));
};
