import type { MediaFile } from "../../state/media";

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
