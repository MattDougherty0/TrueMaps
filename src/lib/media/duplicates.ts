import {
	formatReviewNeeds,
	type MediaClassification,
	type MediaFile
} from "../../state/media";
import {
	hashesFor,
	identityKeysFor,
	looseIdentityKey,
	strongIdentityKey,
	type MediaFingerprint
} from "../../../electron/fingerprint";

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
	fileId?: string;
	openable?: boolean;
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
	const classification = file.classification ? classificationLabels[file.classification] : "Unclassified";
	if (file.trashedAt) return `In trash · ${classification}`;
	const needed = formatReviewNeeds(file);
	if (needed) return `Needs ${needed}`;
	if (file.classification) return `Reviewed as ${classification}`;
	return "Still needs review";
};

export const fingerprintFromFile = (file: MediaFile): MediaFingerprint => ({
	type: file.type,
	sha256: file.sha256,
	storedSha256: file.storedSha256,
	payloadSha256: file.payloadSha256,
	originalName: file.originalName || file.name,
	captureTime: file.captureTime,
	captureSubsec: file.captureSubsec,
	cameraMake: file.cameraMake,
	cameraModel: file.cameraModel,
	width: file.width,
	height: file.height
});

export const hashesForFile = (file: MediaFile): string[] => hashesFor(fingerprintFromFile(file));

export type DuplicateKnown = {
	hashes: string[];
	identityKeys: string[];
};

export const buildDuplicateKnown = (files: MediaFile[]): DuplicateKnown => {
	const hashes = new Set<string>();
	const strongCounts = new Map<string, number>();
	const looseCounts = new Map<string, number>();
	for (const file of files) {
		const fp = fingerprintFromFile(file);
		for (const hash of hashesFor(fp)) hashes.add(hash);
		const strong = strongIdentityKey(fp);
		if (strong) strongCounts.set(strong, (strongCounts.get(strong) || 0) + 1);
		const loose = looseIdentityKey(fp);
		if (loose) looseCounts.set(loose, (looseCounts.get(loose) || 0) + 1);
	}
	const identityKeys = [
		...[...strongCounts.entries()].filter(([, count]) => count >= 1).map(([key]) => key),
		...[...looseCounts.entries()].filter(([, count]) => count === 1).map(([key]) => key)
	];
	return { hashes: [...hashes], identityKeys };
};

export const isBlankLike = (file: MediaFile): boolean =>
	file.classification === "blank" || Boolean(file.trashedAt && !file.classification);

export const hasUsefulClassification = (file: MediaFile): boolean =>
	Boolean(file.classification && file.classification !== "blank");

export const restoreKeeperForReview = (): Partial<MediaFile> => ({
	classification: undefined,
	reviewStatus: "pending",
	trashedAt: undefined,
	duplicateOfId: undefined
});

export const duplicateKeeperScore = (file: MediaFile): number => {
	let score = 0;
	if (hasUsefulClassification(file)) score += 1000;
	if (!file.trashedAt) score += 200;
	if (!isBlankLike(file)) score += 100;
	if (file.cameraSiteId) score += 50;
	if ((file.knownDeerIds || []).length) score += 25;
	const created = Date.parse(file.createdAt);
	if (!Number.isNaN(created)) score -= created / 1e15;
	return score;
};

export const preferDuplicateKeeper = (files: MediaFile[]): MediaFile | undefined => {
	if (!files.length) return undefined;
	return [...files].sort((a, b) => duplicateKeeperScore(b) - duplicateKeeperScore(a))[0];
};

export const findCatalogMatch = (files: MediaFile[], hash: string): MediaFile | undefined =>
	preferDuplicateKeeper(files.filter((file) => hashesForFile(file).includes(hash)));

export const findCatalogMatchForFingerprint = (
	files: MediaFile[],
	fingerprint: MediaFingerprint,
	known: DuplicateKnown = buildDuplicateKnown(files)
): MediaFile | undefined => {
	const incomingHashes = hashesFor(fingerprint);
	const hashHits = files.filter((file) => hashesForFile(file).some((hash) => incomingHashes.includes(hash)));
	if (hashHits.length) return preferDuplicateKeeper(hashHits);
	const keyHit = identityKeysFor(fingerprint).find((key) => known.identityKeys.includes(key));
	if (!keyHit) return undefined;
	return preferDuplicateKeeper(
		files.filter((file) => identityKeysFor(fingerprintFromFile(file)).includes(keyHit))
	);
};

export const findDuplicatePeers = (files: MediaFile[], file: MediaFile): MediaFile[] => {
	const hashes = new Set(hashesForFile(file));
	const strong = strongIdentityKey(fingerprintFromFile(file));
	if (!hashes.size && !strong) return [];
	return files.filter((item) => {
		if (item.id === file.id) return false;
		if (hashesForFile(item).some((hash) => hashes.has(hash))) return true;
		const other = strongIdentityKey(fingerprintFromFile(item));
		return Boolean(strong && other && strong === other);
	});
};

export const findExistingForMatch = (
	catalog: MediaFile[],
	match: { sha256?: string; identityKeys?: string[] }
): MediaFile | undefined => {
	if (match.sha256) {
		const byHash = findCatalogMatch(catalog, match.sha256);
		if (byHash) return byHash;
	}
	if (!match.identityKeys?.length) return undefined;
	return preferDuplicateKeeper(
		catalog.filter((file) =>
			match.identityKeys!.some((identityKey) =>
				identityKeysFor(fingerprintFromFile(file)).includes(identityKey)
			)
		)
	);
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
	review: reviewStatusLabel(existing),
	fileId: existing.id,
	openable: !existing.trashedAt
});

export const restoreBlankKeepers = (files: MediaFile[]): Array<{ id: string; changes: Partial<MediaFile> }> => {
	const seen = new Set<string>();
	const updates: Array<{ id: string; changes: Partial<MediaFile> }> = [];
	for (const file of files) {
		if (!file || seen.has(file.id) || !isBlankLike(file)) continue;
		seen.add(file.id);
		updates.push({ id: file.id, changes: restoreKeeperForReview() });
	}
	return updates;
};

const peerKeysFor = (file: MediaFile): string[] => {
	const keys = hashesForFile(file).map((hash) => `h:${hash}`);
	const strong = strongIdentityKey(fingerprintFromFile(file));
	if (strong) keys.push(`s:${strong}`);
	return keys;
};

export const groupDuplicateCopies = (files: MediaFile[]): MediaFile[][] => {
	const parent = new Map<string, string>();
	const find = (id: string): string => {
		const current = parent.get(id) || id;
		if (current === id) return id;
		const root = find(current);
		parent.set(id, root);
		return root;
	};
	const union = (a: string, b: string) => {
		const rootA = find(a);
		const rootB = find(b);
		if (rootA !== rootB) parent.set(rootA, rootB);
	};
	for (const file of files) parent.set(file.id, file.id);
	const index = new Map<string, string>();
	for (const file of files) {
		for (const key of peerKeysFor(file)) {
			const existing = index.get(key);
			if (existing) union(file.id, existing);
			else index.set(key, file.id);
		}
	}
	const groups = new Map<string, MediaFile[]>();
	for (const file of files) {
		const root = find(file.id);
		const list = groups.get(root);
		if (list) list.push(file);
		else groups.set(root, [file]);
	}
	return [...groups.values()].filter((group) => group.length > 1);
};

export const reconcileDuplicateCopies = (
	files: MediaFile[],
	now = new Date().toISOString()
): Array<{ id: string; changes: Partial<MediaFile> }> => {
	const byId = new Map<string, Partial<MediaFile>>();
	const add = (id: string, changes: Partial<MediaFile>) => {
		byId.set(id, { ...byId.get(id), ...changes });
	};
	for (const group of groupDuplicateCopies(files)) {
		const keeper = preferDuplicateKeeper(group);
		if (!keeper) continue;
		const extras = group.filter((file) => file.id !== keeper.id);
		const unmarkedExtras = extras.filter((file) => !file.duplicateOfId);
		if (isBlankLike(keeper) && unmarkedExtras.length) {
			add(keeper.id, restoreKeeperForReview());
		}
		for (const extra of extras) {
			if (hasUsefulClassification(extra)) continue;
			const extraChanges: Partial<MediaFile> = {};
			if (extra.duplicateOfId !== keeper.id) extraChanges.duplicateOfId = keeper.id;
			if (!extra.trashedAt) {
				extraChanges.classification = "blank";
				extraChanges.reviewStatus = "reviewed";
				extraChanges.trashedAt = now;
			}
			if (Object.keys(extraChanges).length) add(extra.id, extraChanges);
		}
	}
	return [...byId.entries()].map(([id, changes]) => ({ id, changes }));
};

export const warningsFromMatches = (
	matches: Array<{ sha256: string; sourceName: string; identityKeys?: string[] }>,
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
		const existing = findExistingForMatch(catalog, match);
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

const needsFingerprint = (file: MediaFile): boolean =>
	!file.sha256 ||
	!file.storedSha256 ||
	(!file.captureTime && !file.width) ||
	(!file.payloadSha256 && /\.jpe?g$/i.test(file.name || file.path));

export async function ensureMediaHashes(
	projectPath: string,
	files: MediaFile[],
	updateFiles: (updates: Array<{ id: string; changes: Partial<MediaFile> }>) => void
): Promise<string[]> {
	const known = await ensureMediaFingerprints(projectPath, files, updateFiles);
	return known.hashes;
}

export async function ensureMediaFingerprints(
	projectPath: string,
	files: MediaFile[],
	updateFiles: (updates: Array<{ id: string; changes: Partial<MediaFile> }>) => void
): Promise<DuplicateKnown> {
	const missing = files.filter((file) => needsFingerprint(file));
	let updates: Array<{ id: string; changes: Partial<MediaFile> }> = [];
	if (missing.length && typeof window.api.inspectMediaFiles === "function") {
		const inspected = await window.api.inspectMediaFiles(
			projectPath,
			missing.map((file) => file.path)
		);
		const byPath = new Map(inspected.map((item) => [item.path, item]));
		updates = missing.flatMap((file) => {
			const fingerprint = byPath.get(file.path);
			if (!fingerprint) return [];
			const changes: Partial<MediaFile> = {
				storedSha256: file.storedSha256 || fingerprint.sha256,
				sha256: file.sha256 || fingerprint.sha256,
				payloadSha256: file.payloadSha256 || fingerprint.payloadSha256,
				originalName: file.originalName || fingerprint.originalName,
				captureTime: file.captureTime || fingerprint.captureTime,
				captureSubsec: file.captureSubsec || fingerprint.captureSubsec,
				cameraMake: file.cameraMake || fingerprint.cameraMake,
				cameraModel: file.cameraModel || fingerprint.cameraModel,
				width: file.width || fingerprint.width,
				height: file.height || fingerprint.height
			};
			return [{ id: file.id, changes }];
		});
	} else if (missing.length && typeof window.api.hashMediaFiles === "function") {
		const indexed = await window.api.hashMediaFiles(
			projectPath,
			missing.map((file) => file.path)
		);
		const hashByPath = new Map(indexed.map((item) => [item.path, item.sha256]));
		updates = missing
			.map((file) => ({ id: file.id, hash: hashByPath.get(file.path) }))
			.filter((item): item is { id: string; hash: string } => Boolean(item.hash))
			.map((item) => ({ id: item.id, changes: { sha256: item.hash, storedSha256: item.hash } }));
	}
	if (updates.length) updateFiles(updates);
	const byId = new Map(updates.map((update) => [update.id, update.changes]));
	return buildDuplicateKnown(
		files.map((file) => {
			const changes = byId.get(file.id);
			return changes ? { ...file, ...changes } : file;
		})
	);
}
