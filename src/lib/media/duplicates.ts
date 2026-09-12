import {
	formatReviewNeeds,
	type MediaClassification,
	type MediaFile
} from "../../state/media";

export const classificationLabels: Record<MediaClassification, string> = {
	known_buck: "Known buck",
	unknown_buck: "Unknown buck",
	scrub_buck: "Scrub buck",
	doe: "Doe",
	other_animal: "Other animal",
	blank: "Blank / misfire"
};

export type MediaSiteRef = {
	id: string;
	name: string;
	areaName?: string | null;
	propertyId?: string | null;
};

export type DuplicateWarning = {
	sourceName: string;
	existingName: string;
	location: string;
	review: string;
};

const folderPathOf = (file: MediaFile): string => {
	if (!file.path.includes("/")) return "Unassigned";
	return file.path.slice(0, file.path.lastIndexOf("/"));
};

export const locationLabel = (
	file: MediaFile,
	sites: MediaSiteRef[],
	propertyNames?: Map<string, string>
): string => {
	const site = sites.find((item) => item.id === file.cameraSiteId);
	if (site) {
		const area = site.areaName || propertyNames?.get(site.propertyId || "") || file.areaName;
		return area ? `${area} / ${site.name}` : site.name;
	}
	if (file.areaName) return `${file.areaName} · ${folderPathOf(file)}`;
	return folderPathOf(file);
};

export const reviewStatusLabel = (file: MediaFile): string => {
	if (file.trashedAt) return "In trash (blank / misfire)";
	const needed = formatReviewNeeds(file);
	if (needed) return `Needs ${needed}`;
	if (file.classification) return `Reviewed as ${classificationLabels[file.classification]}`;
	return "Still needs review";
};

export const findCatalogMatch = (files: MediaFile[], hash: string): MediaFile | undefined =>
	files.find((file) => file.sha256 === hash);

export const findDuplicatePeers = (files: MediaFile[], file: MediaFile): MediaFile[] => {
	if (!file.sha256) return [];
	return files.filter((item) => item.id !== file.id && item.sha256 === file.sha256);
};

export const describeMediaDuplicate = (
	existing: MediaFile,
	sourceName: string,
	sites: MediaSiteRef[],
	propertyNames?: Map<string, string>
): DuplicateWarning => ({
	sourceName,
	existingName: existing.name,
	location: locationLabel(existing, sites, propertyNames),
	review: reviewStatusLabel(existing)
});

export const warningsFromMatches = (
	matches: Array<{ sha256: string; sourceName: string }>,
	catalog: MediaFile[],
	sites: MediaSiteRef[],
	propertyNames?: Map<string, string>
): DuplicateWarning[] => {
	const seen = new Set<string>();
	const warnings: DuplicateWarning[] = [];
	for (const match of matches) {
		const key = `${match.sha256}:${match.sourceName}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const existing = findCatalogMatch(catalog, match.sha256);
		if (existing) {
			warnings.push(describeMediaDuplicate(existing, match.sourceName, sites, propertyNames));
		} else {
			warnings.push({
				sourceName: match.sourceName,
				existingName: match.sourceName,
				location: "Already in this project",
				review: "Previously imported"
			});
		}
	}
	return warnings;
};

export async function ensureMediaHashes(
	projectPath: string,
	files: MediaFile[],
	updateFiles: (updates: Array<{ id: string; changes: Partial<MediaFile> }>) => void
): Promise<string[]> {
	let hashes = files.map((file) => file.sha256).filter((hash): hash is string => Boolean(hash));
	const missing = files.filter((file) => !file.sha256 && !file.trashedAt);
	if (!missing.length || typeof window.api.hashMediaFiles !== "function") return hashes;
	const indexed = await window.api.hashMediaFiles(
		projectPath,
		missing.map((file) => file.path)
	);
	const hashByPath = new Map(indexed.map((item) => [item.path, item.sha256]));
	const updates = missing
		.map((file) => ({ id: file.id, hash: hashByPath.get(file.path) }))
		.filter((item): item is { id: string; hash: string } => Boolean(item.hash));
	if (updates.length) {
		updateFiles(updates.map((item) => ({ id: item.id, changes: { sha256: item.hash } })));
		hashes = [...hashes, ...updates.map((item) => item.hash)];
	}
	return hashes;
}
