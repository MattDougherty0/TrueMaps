import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import useAppStore from "../../state/store";
import {
	fileNeedsReview,
	useMediaStore,
	type KnownDeer,
	type MediaClassification,
	type MediaFile,
	type StoredCameraSite
} from "../../state/media";
import {
	createCameraSite,
	loadCameraSites,
	updateCameraSiteArea,
	type CameraSite
} from "../../lib/media/cameraSites";
import { borderRadius, colors, spacing, typography } from "../../lib/theme";

type ManagerView = "cameras" | "deer" | "trash" | "review";
type CameraBrowse =
	| { level: "home" }
	| { level: "needs-review" }
	| { level: "site"; siteId: string }
	| { level: "needs-review-site"; siteId: string };

type TrailCameraMediaManagerProps = {
	onClose: () => void;
	onOpenContent: () => void;
	initialCameraName?: string | null;
	initialCameraSiteId?: string | null;
};

const UNASSIGNED_SITE_ID = "__unassigned__";

const createId = (prefix: string): string =>
	`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const safePathPart = (value: string): string =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "") || "default";

const toMediaUrl = (mediaPath: string): string => {
	const segments = mediaPath.split("/").filter(Boolean).map((part) => encodeURIComponent(part));
	return `media:///${segments.join("/")}`;
};

const classificationLabels: Record<MediaClassification, string> = {
	known_buck: "Known buck",
	unknown_buck: "Unknown buck",
	doe: "Doe",
	other_animal: "Other animal",
	blank: "Blank / misfire"
};

const inputStyle: CSSProperties = {
	padding: "8px 10px",
	borderRadius: borderRadius.md,
	border: `1px solid ${colors.borderMedium}`,
	background: colors.bgPanelSolid,
	color: colors.textPrimary,
	fontSize: typography.fontSize.sm
};

const buttonStyle: CSSProperties = {
	padding: "8px 12px",
	borderRadius: borderRadius.md,
	border: `1px solid ${colors.borderMedium}`,
	background: colors.bgButton,
	color: colors.textPrimary,
	cursor: "pointer",
	fontSize: typography.fontSize.sm,
	fontWeight: typography.fontWeight.medium
};

const primaryButtonStyle: CSSProperties = {
	...buttonStyle,
	background: colors.primary,
	borderColor: colors.primary,
	color: colors.textOnPrimary
};

const shortcutHintStyle: CSSProperties = {
	marginLeft: 6,
	fontSize: typography.fontSize.xs,
	fontWeight: typography.fontWeight.semibold,
	opacity: 0.7
};

const isTypingTarget = (target: EventTarget | null): boolean => {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

const sortByDate = (files: MediaFile[]): MediaFile[] =>
	[...files].sort((a, b) => (b.capturedAt || b.createdAt).localeCompare(a.capturedAt || a.createdAt));

const filesForSite = (files: MediaFile[], siteId: string): MediaFile[] =>
	sortByDate(
		files.filter((file) =>
			siteId === UNASSIGNED_SITE_ID ? !file.cameraSiteId : file.cameraSiteId === siteId
		)
	);

const formatCaptureDate = (iso?: string): string => {
	if (!iso) return "Unknown date";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "Unknown date";
	return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const formatCaptureDateTime = (iso?: string): string => {
	if (!iso) return "Unknown date";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "Unknown date";
	return date.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});
};

const latestDateLabel = (files: MediaFile[]): string | undefined => {
	const latest = files[0]?.capturedAt || files[0]?.createdAt;
	return latest ? `Latest ${formatCaptureDate(latest)}` : undefined;
};

const dateKey = (file: MediaFile): string => {
	const iso = file.capturedAt || file.createdAt;
	if (!iso) return "unknown";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "unknown";
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const groupFilesByDate = (files: MediaFile[]): Array<{ key: string; label: string; files: MediaFile[] }> => {
	const groups = new Map<string, MediaFile[]>();
	for (const file of files) {
		const key = dateKey(file);
		const list = groups.get(key);
		if (list) list.push(file);
		else groups.set(key, [file]);
	}
	return [...groups.entries()]
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([key, grouped]) => ({
			key,
			label: key === "unknown" ? "Unknown date" : formatCaptureDate(`${key}T12:00:00`),
			files: grouped
		}));
};

const mergeCameraSites = (geoSites: CameraSite[], stored: StoredCameraSite[]): CameraSite[] => {
	const byId = new Map<string, CameraSite>();
	for (const site of stored) {
		byId.set(site.id, {
			id: site.id,
			name: site.name,
			propertyId: site.propertyId,
			areaName: site.areaName,
			coordinates: site.coordinates
		});
	}
	for (const site of geoSites) {
		const existing = byId.get(site.id);
		byId.set(site.id, existing ? { ...existing, ...site } : site);
	}
	return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
};

function MediaPreview({ file, large = false }: { file: MediaFile; large?: boolean }) {
	const url = toMediaUrl(file.path);
	if (file.type === "video") {
		return (
			<video
				src={url}
				controls={large}
				muted={!large}
				preload="metadata"
				style={{
					width: "100%",
					height: "100%",
					objectFit: "contain",
					background: "#111"
				}}
			/>
		);
	}
	return (
		<img
			src={url}
			alt={file.name}
			style={{ width: "100%", height: "100%", objectFit: large ? "contain" : "cover", background: "#111" }}
		/>
	);
}

function MediaCard({
	file,
	cameraName,
	deerNames,
	onClick
}: {
	file: MediaFile;
	cameraName?: string;
	deerNames: string[];
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				textAlign: "left",
				padding: 0,
				borderRadius: borderRadius.lg,
				border: `1px solid ${colors.borderMedium}`,
				background: colors.bgPanelSolid,
				overflow: "hidden",
				cursor: "pointer",
				color: colors.textPrimary
			}}
		>
			<div style={{ height: 130 }}>
				<MediaPreview file={file} />
			</div>
			<div style={{ padding: spacing.md, display: "grid", gap: 3 }}>
				<div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, overflow: "hidden", textOverflow: "ellipsis" }}>
					{file.name}
				</div>
				<div style={{ fontSize: typography.fontSize.xs, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>
					{formatCaptureDateTime(file.capturedAt || file.createdAt)}
				</div>
				<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
					{cameraName || "Unassigned camera"}
				</div>
				<div style={{ fontSize: typography.fontSize.xs, color: file.classification === "blank" ? colors.error : colors.textSecondary }}>
					{file.classification ? classificationLabels[file.classification] : "Needs review"}
					{deerNames.length ? ` · ${deerNames.join(", ")}` : ""}
				</div>
			</div>
		</button>
	);
}

function FolderCard({
	title,
	subtitle,
	meta,
	preview,
	accent = "default",
	onClick
}: {
	title: string;
	subtitle?: string;
	meta?: string;
	preview?: ReactNode;
	accent?: "default" | "review";
	onClick: () => void;
}) {
	const isReview = accent === "review";
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				textAlign: "left",
				padding: 0,
				borderRadius: borderRadius.lg,
				border: `1px solid ${isReview ? colors.primaryBorder : colors.borderMedium}`,
				background: isReview ? colors.primaryLight : colors.bgPanelSolid,
				overflow: "hidden",
				cursor: "pointer",
				color: colors.textPrimary,
				minHeight: 170
			}}
		>
			<div
				style={{
					height: 96,
					width: "100%",
					background: isReview ? "rgba(255, 107, 53, 0.18)" : colors.thumbWarm,
					display: "grid",
					placeItems: "center",
					overflow: "hidden"
				}}
			>
				{preview ? (
					<div style={{ width: "100%", height: "100%" }}>{preview}</div>
				) : (
					<div style={{ fontSize: 36, lineHeight: 1 }}>{isReview ? "🔎" : "📁"}</div>
				)}
			</div>
			<div style={{ padding: spacing.md, display: "grid", gap: 3 }}>
				<div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, overflow: "hidden", textOverflow: "ellipsis" }}>
					{title}
				</div>
				{subtitle ? <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>{subtitle}</div> : null}
				{meta ? <div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>{meta}</div> : null}
			</div>
		</button>
	);
}

export default function TrailCameraMediaManager({
	onClose,
	onOpenContent,
	initialCameraName,
	initialCameraSiteId
}: TrailCameraMediaManagerProps) {
	const { projectPath, activePropertyId, properties } = useAppStore();
	const {
		folders,
		files,
		knownDeer,
		importSessions,
		addFiles,
		updateFile,
		updateFiles,
		addKnownDeer,
		addImportSession,
		addCameraSite,
		loadFromProject,
		saveToProject
	} = useMediaStore();
	const [sites, setSites] = useState<CameraSite[]>([]);
	const [cameraBrowse, setCameraBrowse] = useState<CameraBrowse>({ level: "home" });
	const [deerBrowse, setDeerBrowse] = useState<"home" | "deer">("home");
	const [selectedDeerId, setSelectedDeerId] = useState("");
	const [newDeerName, setNewDeerName] = useState("");
	const [existingFolderId, setExistingFolderId] = useState("");
	const [view, setView] = useState<ManagerView>("cameras");
	const [reviewReturnView, setReviewReturnView] = useState<Exclude<ManagerView, "review">>("cameras");
	const [loading, setLoading] = useState(true);
	const [importing, setImporting] = useState(false);
	const [importProgress, setImportProgress] = useState<{
		processed: number;
		total: number;
		fileName: string;
		stage: string;
	} | null>(null);
	const [message, setMessage] = useState("");
	const [reviewIds, setReviewIds] = useState<string[]>([]);
	const [reviewIndex, setReviewIndex] = useState(0);
	const [areaName, setAreaName] = useState("");
	const [creatingSite, setCreatingSite] = useState(false);
	const [newSiteName, setNewSiteName] = useState("");
	const [newSitePropertyId, setNewSitePropertyId] = useState("");
	const [newSiteArea, setNewSiteArea] = useState("");
	const [sdDeleteStats, setSdDeleteStats] = useState({ deleted: 0, missing: 0, failed: 0 });
	const reviewIndexRef = useRef(0);
	const reviewIdsRef = useRef<string[]>([]);
	const selectedDeerIdRef = useRef("");

	useEffect(() => {
		if (!projectPath) return;
		let cancelled = false;
		(async () => {
			setLoading(true);
			await loadFromProject(projectPath);
			try {
				const propertyIds = properties.length
					? properties.map((property) => property.id)
					: [activePropertyId];
				const loadedSites = (
					await Promise.all(
						propertyIds.map((propertyId) =>
							loadCameraSites(projectPath, propertyId).catch((error) => {
								console.warn("Failed to load camera sites for property", propertyId, error);
								return [];
							})
						)
					)
				).flat();
				if (cancelled) return;
				const merged = mergeCameraSites(loadedSites, useMediaStore.getState().cameraSites);
				setSites(merged);
				const initial =
					merged.find((site) => site.id === initialCameraSiteId) ||
					merged.find((site) => site.name === initialCameraName);
				if (initial) {
					setCameraBrowse({ level: "site", siteId: initial.id });
				} else {
					setCameraBrowse({ level: "home" });
				}
			} catch (error) {
				console.error("Failed to load trail camera sites", error);
				if (!cancelled) setMessage("Could not load trail camera sites.");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectPath, activePropertyId, properties, initialCameraName, initialCameraSiteId]);

	useEffect(() => {
		if (typeof window.api.onTrailCameraImportProgress !== "function") return;
		return window.api.onTrailCameraImportProgress(setImportProgress);
	}, []);

	const browsingSiteId =
		cameraBrowse.level === "site" || cameraBrowse.level === "needs-review-site"
			? cameraBrowse.siteId
			: "";
	const selectedSite = sites.find((site) => site.id === browsingSiteId) || null;
	const siteNames = useMemo(() => new Map(sites.map((site) => [site.id, site.name])), [sites]);
	const deerNames = useMemo(() => new Map(knownDeer.map((deer) => [deer.id, deer.name])), [knownDeer]);
	const propertyNames = useMemo(
		() => new Map(properties.map((property) => [property.id, property.name])),
		[properties]
	);

	useEffect(() => {
		if (!selectedSite) {
			setAreaName("");
			return;
		}
		const inferred =
			selectedSite.areaName ||
			(selectedSite.propertyId === "camp"
				? "Camp"
				: propertyNames.get(selectedSite.propertyId || "") || "Property");
		setAreaName(inferred);
	}, [selectedSite, propertyNames]);

	const activeFiles = useMemo(() => files.filter((file) => !file.trashedAt), [files]);
	const reviewNeededFiles = useMemo(() => activeFiles.filter(fileNeedsReview), [activeFiles]);
	const selectedSiteFiles = useMemo(
		() => (browsingSiteId ? filesForSite(activeFiles, browsingSiteId) : []),
		[activeFiles, browsingSiteId]
	);
	const visibleSiteFiles = useMemo(
		() =>
			cameraBrowse.level === "needs-review-site"
				? selectedSiteFiles.filter(fileNeedsReview)
				: selectedSiteFiles,
		[cameraBrowse.level, selectedSiteFiles]
	);
	const selectedDeerFiles = useMemo(
		() => sortByDate(activeFiles.filter((file) => file.knownDeerIds?.includes(selectedDeerId))),
		[activeFiles, selectedDeerId]
	);
	const trashedFiles = useMemo(
		() => files.filter((file) => file.trashedAt).sort((a, b) => String(b.trashedAt).localeCompare(String(a.trashedAt))),
		[files]
	);
	const reviewFiles = reviewIds.map((id) => files.find((file) => file.id === id)).filter(Boolean) as MediaFile[];
	const currentReviewFile = reviewFiles[reviewIndex] || null;

	useEffect(() => {
		reviewIndexRef.current = reviewIndex;
	}, [reviewIndex]);
	useEffect(() => {
		reviewIdsRef.current = reviewIds;
	}, [reviewIds]);
	useEffect(() => {
		selectedDeerIdRef.current = selectedDeerId;
	}, [selectedDeerId]);
	const unassignedFiles = useMemo(() => filesForSite(activeFiles, UNASSIGNED_SITE_ID), [activeFiles]);
	const pendingBySiteId = useMemo(() => {
		const counts = new Map<string, MediaFile[]>();
		for (const file of reviewNeededFiles) {
			const siteId = file.cameraSiteId || UNASSIGNED_SITE_ID;
			const list = counts.get(siteId);
			if (list) list.push(file);
			else counts.set(siteId, [file]);
		}
		for (const [siteId, list] of counts) {
			counts.set(siteId, sortByDate(list));
		}
		return counts;
	}, [reviewNeededFiles]);

	const siteLabel = (siteId: string): string => {
		if (siteId === UNASSIGNED_SITE_ID) return "Unassigned";
		const site = sites.find((item) => item.id === siteId);
		return site?.name || "Unknown camera";
	};

	const siteAreaLabel = (siteId: string): string | undefined => {
		if (siteId === UNASSIGNED_SITE_ID) return "No camera location yet";
		const site = sites.find((item) => item.id === siteId);
		if (!site) return undefined;
		return site.areaName || propertyNames.get(site.propertyId || "") || undefined;
	};

	const createKnownDeer = async (): Promise<string | null> => {
		if (!projectPath || !newDeerName.trim()) return null;
		const existing = knownDeer.find((deer) => deer.name.toLowerCase() === newDeerName.trim().toLowerCase());
		if (existing) {
			setSelectedDeerId(existing.id);
			setNewDeerName("");
			return existing.id;
		}
		const now = new Date().toISOString();
		const deer: KnownDeer = {
			id: createId("deer"),
			name: newDeerName.trim(),
			createdAt: now,
			updatedAt: now
		};
		addKnownDeer(deer);
		setSelectedDeerId(deer.id);
		setNewDeerName("");
		await saveToProject(projectPath);
		return deer.id;
	};

	const filesInFolder = (folderPath: string): MediaFile[] =>
		files.filter((file) => file.path === folderPath || file.path.startsWith(`${folderPath}/`));

	const linkExistingFolderToSite = async () => {
		if (!projectPath || !selectedSite || !existingFolderId) return;
		const folder = folders.find((item) => item.id === existingFolderId);
		if (!folder) return;
		const matchingFiles = filesInFolder(folder.path);
		updateFiles(
			matchingFiles.map((file) => ({
				id: file.id,
				changes: {
					cameraSiteId: selectedSite.id,
					propertyId: selectedSite.propertyId || undefined,
					areaName: areaName || selectedSite.areaName || undefined
				}
			}))
		);
		await saveToProject(projectPath);
		setMessage(`Linked ${matchingFiles.length} existing file(s) from ${folder.name} to ${selectedSite.name}.`);
		setExistingFolderId("");
	};

	const createDeerFromFolder = async () => {
		if (!projectPath || !existingFolderId) return;
		const folder = folders.find((item) => item.id === existingFolderId);
		if (!folder) return;
		const now = new Date().toISOString();
		const existing = knownDeer.find((deer) => deer.name.toLowerCase() === folder.name.toLowerCase());
		const deerId = existing?.id || createId("deer");
		if (!existing) {
			addKnownDeer({
				id: deerId,
				name: folder.name,
				createdAt: now,
				updatedAt: now
			});
		}
		const matchingFiles = filesInFolder(folder.path);
		updateFiles(
			matchingFiles.map((file) => ({
				id: file.id,
				changes: {
					classification: "known_buck",
					reviewStatus: "reviewed",
					knownDeerIds: Array.from(new Set([...(file.knownDeerIds || []), deerId]))
				}
			}))
		);
		setSelectedDeerId(deerId);
		setDeerBrowse("deer");
		setExistingFolderId("");
		await saveToProject(projectPath);
		setMessage(`Created ${folder.name} and linked ${matchingFiles.length} existing file(s) without moving them.`);
	};

	const startReview = (siteFiles: MediaFile[], startId?: string) => {
		const ids = siteFiles.map((file) => file.id);
		const nextIndex = Math.max(0, startId ? ids.indexOf(startId) : 0);
		reviewIdsRef.current = ids;
		reviewIndexRef.current = nextIndex;
		setReviewReturnView(view === "deer" ? "deer" : "cameras");
		setReviewIds(ids);
		setReviewIndex(nextIndex);
		setSdDeleteStats({ deleted: 0, missing: 0, failed: 0 });
		setView("review");
	};

	const saveCameraArea = async (nextAreaName: string) => {
		if (!projectPath || !selectedSite || !nextAreaName.trim()) return;
		try {
			await updateCameraSiteArea(
				projectPath,
				selectedSite.propertyId,
				selectedSite.id,
				nextAreaName.trim()
			);
		} catch {
			// Media-only sites are not in GeoJSON yet; keep the in-memory/area metadata anyway.
		}
		setSites((current) =>
			current.map((site) =>
				site.id === selectedSite.id ? { ...site, areaName: nextAreaName.trim() } : site
			)
		);
		addCameraSite({
			...selectedSite,
			areaName: nextAreaName.trim()
		});
		updateFiles(
			files
				.filter((file) => file.cameraSiteId === selectedSite.id)
				.map((file) => ({ id: file.id, changes: { areaName: nextAreaName.trim() } }))
		);
		await saveToProject(projectPath);
		setMessage(`Camera area set to ${nextAreaName.trim()}.`);
	};

	const assignCurrentCamera = async (cameraSiteId: string) => {
		if (!projectPath || !currentReviewFile) return;
		if (!cameraSiteId) {
			updateFile(currentReviewFile.id, {
				cameraSiteId: undefined,
				propertyId: undefined,
				areaName: undefined
			});
			await saveToProject(projectPath);
			return;
		}
		const site = sites.find((item) => item.id === cameraSiteId);
		if (!site) return;
		const nextArea =
			site.areaName ||
			(site.propertyId === "camp"
				? "Camp"
				: propertyNames.get(site.propertyId || "") || currentReviewFile.areaName);
		updateFile(currentReviewFile.id, {
			cameraSiteId: site.id,
			propertyId: site.propertyId || undefined,
			areaName: nextArea || undefined
		});
		await saveToProject(projectPath);
	};

	const toggleCurrentDeer = async (deerId: string) => {
		if (!projectPath || !currentReviewFile) return;
		const currentIds = currentReviewFile.knownDeerIds || [];
		const nextIds = currentIds.includes(deerId)
			? currentIds.filter((id) => id !== deerId)
			: [...currentIds, deerId];
		updateFile(currentReviewFile.id, {
			knownDeerIds: nextIds,
			classification: nextIds.length
				? "known_buck"
				: currentReviewFile.classification === "known_buck"
				? "unknown_buck"
				: currentReviewFile.classification
		});
		await saveToProject(projectPath);
	};

	const assignCurrentDeer = async (deerId: string) => {
		if (!projectPath || !currentReviewFile) return;
		const currentIds = currentReviewFile.knownDeerIds || [];
		if (currentIds.includes(deerId)) return;
		updateFile(currentReviewFile.id, {
			knownDeerIds: [...currentIds, deerId],
			classification: "known_buck"
		});
		await saveToProject(projectPath);
	};

	const handleCreateSite = async () => {
		if (!projectPath || !newSiteName.trim()) return;
		const propertyId = newSitePropertyId || activePropertyId || properties[0]?.id || "default";
		const property = properties.find((item) => item.id === propertyId);
		try {
			const site = await createCameraSite(projectPath, {
				name: newSiteName.trim(),
				propertyId,
				areaName: newSiteArea.trim() || property?.name || null
			});
			addCameraSite(site);
			setSites((current) =>
				[...current.filter((item) => item.id !== site.id), site].sort((a, b) => a.name.localeCompare(b.name))
			);
			await saveToProject(projectPath);
			setCreatingSite(false);
			setNewSiteName("");
			setNewSiteArea("");
			setCameraBrowse({ level: "site", siteId: site.id });
			setMessage(`Created ${site.name}. You can import its SD card from this folder.`);
		} catch (error) {
			console.error("Failed to create camera site", error);
			setMessage("Could not create that camera site.");
		}
	};

	const handleImport = async () => {
		if (!projectPath || !selectedSite || typeof window.api.importTrailCameraMedia !== "function") return;
		const sourceFolder = await window.api.chooseDirectory();
		if (!sourceFolder) return;
		if (areaName.trim() && selectedSite.areaName !== areaName.trim()) {
			await saveCameraArea(areaName);
		}
		const sessionId = createId("cam_import");
		const datePart = new Date().toISOString().slice(0, 10);
		const importArea =
			areaName ||
			selectedSite.areaName ||
			propertyNames.get(selectedSite.propertyId || "") ||
			"Property";
		const targetFolder = `${safePathPart(importArea)}/cameras/${safePathPart(selectedSite.name)}/${datePart}_${sessionId.slice(-8)}`;
		setImporting(true);
		setMessage("Indexing existing media for duplicate detection…");
		try {
			let knownHashes = files.map((file) => file.sha256).filter((hash): hash is string => Boolean(hash));
			const missingHashes = files.filter((file) => !file.sha256 && !file.trashedAt);
			if (missingHashes.length && typeof window.api.hashMediaFiles === "function") {
				const indexed = await window.api.hashMediaFiles(projectPath, missingHashes.map((file) => file.path));
				const hashByPath = new Map(indexed.map((item) => [item.path, item.sha256]));
				const hashUpdates = missingHashes
					.map((file) => ({ id: file.id, hash: hashByPath.get(file.path) }))
					.filter((item): item is { id: string; hash: string } => Boolean(item.hash));
				if (hashUpdates.length) {
					updateFiles(hashUpdates.map((item) => ({ id: item.id, changes: { sha256: item.hash } })));
					await saveToProject(projectPath);
					knownHashes = [...knownHashes, ...hashUpdates.map((item) => item.hash)];
				}
			}
			setMessage("Copying media and checking for duplicates…");
			const result = await window.api.importTrailCameraMedia(
				projectPath,
				sourceFolder,
				targetFolder,
				knownHashes
			);
			const now = new Date().toISOString();
			const importedFiles: MediaFile[] = result.files.map((file) => ({
				id: createId("file"),
				name: file.name,
				path: file.path,
				type: file.type,
				sha256: file.sha256,
				propertyId: selectedSite.propertyId || undefined,
				areaName: importArea,
				cameraSiteId: selectedSite.id,
				importSessionId: sessionId,
				capturedAt: file.capturedAt,
				reviewStatus: "pending",
				knownDeerIds: [],
				sourcePath: file.sourcePath,
				sourceRelativePath: file.sourceRelativePath,
				createdAt: now,
				updatedAt: now
			}));
			addFiles(importedFiles);
			addImportSession({
				id: sessionId,
				propertyId: selectedSite.propertyId,
				cameraSiteId: selectedSite.id,
				cameraSiteName: selectedSite.name,
				areaName: importArea,
				sourceFolder,
				importedAt: now,
				fileIds: importedFiles.map((file) => file.id),
				skippedDuplicates: result.skippedDuplicates,
				failedFiles: result.failedFiles
			});
			await saveToProject(projectPath);
			setMessage(
				`Imported ${importedFiles.length} file(s). Skipped ${result.skippedDuplicates} duplicate(s)` +
					(result.failedFiles.length ? `; ${result.failedFiles.length} failed.` : ".")
			);
			if (importedFiles.length) startReview(importedFiles);
		} catch (error) {
			console.error("Trail camera import failed", error);
			setMessage("Import failed. The source files were not changed.");
		} finally {
			setImporting(false);
			setImportProgress(null);
		}
	};

	const tryDeleteSourceOriginal = async (
		file: MediaFile
	): Promise<"deleted" | "missing" | "skipped" | "failed"> => {
		if (!projectPath || file.sourceDeletedAt) return "skipped";
		if (!file.sourcePath && !file.sourceRelativePath) return "skipped";
		const session = importSessions.find((item) => item.id === file.importSessionId);
		if (!session?.sourceFolder || typeof window.api.deleteTrailCameraSource !== "function") return "skipped";
		try {
			const result = await window.api.deleteTrailCameraSource({
				projectPath,
				sourceRoot: session.sourceFolder,
				sourcePath: file.sourcePath,
				sourceRelativePath: file.sourceRelativePath
			});
			if (result.deleted) return "deleted";
			if (result.status === "missing") return "missing";
			return "failed";
		} catch (error) {
			console.warn("Failed to delete trail camera source file", error);
			return "failed";
		}
	};

	const classifyCurrent = async (classification: MediaClassification) => {
		if (!projectPath) return;
		const index = reviewIndexRef.current;
		const fileId = reviewIdsRef.current[index];
		if (!fileId) return;
		const file = useMediaStore.getState().files.find((item) => item.id === fileId);
		if (!file) return;
		const taggedDeerIds = file.knownDeerIds || [];
		if (classification === "known_buck" && !selectedDeerIdRef.current && !taggedDeerIds.length) {
			setMessage("Choose or create a known deer first.");
			return;
		}
		reviewIndexRef.current = index + 1;
		setReviewIndex(index + 1);
		const changes: Partial<MediaFile> = {
			classification,
			reviewStatus: "reviewed",
			knownDeerIds:
				classification === "known_buck"
					? Array.from(new Set([...taggedDeerIds, ...(selectedDeerIdRef.current ? [selectedDeerIdRef.current] : [])]))
					: []
		};
		if (classification === "blank") {
			const sdStatus = await tryDeleteSourceOriginal(file);
			if (sdStatus === "deleted") {
				changes.sourceDeletedAt = new Date().toISOString();
				setSdDeleteStats((current) => ({ ...current, deleted: current.deleted + 1 }));
			} else if (sdStatus === "missing") {
				setSdDeleteStats((current) => ({ ...current, missing: current.missing + 1 }));
			} else if (sdStatus === "failed") {
				setSdDeleteStats((current) => ({ ...current, failed: current.failed + 1 }));
			}
		}
		updateFile(file.id, changes);
		await saveToProject(projectPath);
		setMessage("");
	};

	const stepReview = (delta: number) => {
		const next = Math.min(reviewIdsRef.current.length, Math.max(0, reviewIndexRef.current + delta));
		reviewIndexRef.current = next;
		setReviewIndex(next);
	};

	const finishReview = async () => {
		if (!projectPath) return;
		const stateFiles = useMediaStore.getState().files;
		const blankFiles = stateFiles.filter(
			(file) => reviewIds.includes(file.id) && file.classification === "blank" && !file.trashedAt
		);
		const trashedAt = new Date().toISOString();
		const changes = blankFiles.map((file) => ({
			id: file.id,
			changes: { trashedAt }
		}));
		if (changes.length) updateFiles(changes);
		await saveToProject(projectPath);
		const sdParts = [
			`${changes.length} blank/misfire file(s) moved to recoverable Trash.`
		];
		if (sdDeleteStats.deleted) {
			sdParts.push(`Deleted ${sdDeleteStats.deleted} original(s) from the SD card.`);
		}
		if (sdDeleteStats.missing) {
			sdParts.push(
				`${sdDeleteStats.missing} original(s) were already gone or the card was ejected.`
			);
		}
		if (sdDeleteStats.failed) {
			sdParts.push(`${sdDeleteStats.failed} original(s) could not be deleted from the SD card.`);
		}
		setMessage(`Review complete. ${sdParts.join(" ")}`);
		setView(reviewReturnView);
		setReviewIds([]);
		setReviewIndex(0);
	};

	useEffect(() => {
		if (view !== "review") return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTypingTarget(event.target)) return;
			const key = event.key;
			if (key === "Escape") {
				event.preventDefault();
				setView(reviewReturnView);
				return;
			}
			if (reviewIndexRef.current >= reviewIdsRef.current.length) {
				if (key === "Enter") {
					event.preventDefault();
					void finishReview();
				}
				return;
			}
			if (key === "1" || key === "x" || key === "X") {
				event.preventDefault();
				void classifyCurrent("blank");
				return;
			}
			if (key === "2" || key === "d" || key === "D") {
				event.preventDefault();
				void classifyCurrent("doe");
				return;
			}
			if (key === "3" || key === "u" || key === "U") {
				event.preventDefault();
				void classifyCurrent("unknown_buck");
				return;
			}
			if (key === "4" || key === "o" || key === "O") {
				event.preventDefault();
				void classifyCurrent("other_animal");
				return;
			}
			if (key === "5" || key === "k" || key === "K") {
				event.preventDefault();
				void classifyCurrent("known_buck");
				return;
			}
			if (key === "ArrowLeft") {
				event.preventDefault();
				stepReview(-1);
				return;
			}
			if (key === "ArrowRight") {
				event.preventDefault();
				stepReview(1);
			}
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [view, reviewReturnView, classifyCurrent, finishReview]);

	const restoreFile = async (file: MediaFile) => {
		if (!projectPath) return;
		updateFile(file.id, { trashedAt: undefined });
		await saveToProject(projectPath);
	};

	const openCreateSite = () => {
		const propertyId = activePropertyId || properties[0]?.id || "default";
		const property = properties.find((item) => item.id === propertyId);
		setNewSitePropertyId(propertyId);
		setNewSiteArea(property?.name || "");
		setNewSiteName("");
		setCreatingSite(true);
	};

	const modalStyle: CSSProperties = {
		position: "fixed",
		inset: 0,
		zIndex: 2600,
		background: colors.overlay,
		display: "grid",
		placeItems: "center",
		padding: spacing.xxl
	};

	const panelStyle: CSSProperties = {
		width: "min(1200px, 96vw)",
		height: "min(850px, 92vh)",
		background: colors.bgPanelSolid,
		border: `1px solid ${colors.borderMedium}`,
		borderRadius: borderRadius.xl,
		boxShadow: colors.shadowXLarge,
		overflow: "hidden",
		display: "flex",
		flexDirection: "column",
		color: colors.textPrimary,
		fontFamily: typography.fontFamily
	};

	const crumbButton = (label: string, onClick?: () => void, current = false) => (
		<button
			key={label}
			onClick={onClick}
			disabled={!onClick}
			style={{
				...buttonStyle,
				padding: "4px 8px",
				background: "transparent",
				borderColor: "transparent",
				color: current ? colors.textPrimary : colors.primary,
				cursor: onClick ? "pointer" : "default",
				fontWeight: current ? typography.fontWeight.semibold : typography.fontWeight.medium
			}}
		>
			{label}
		</button>
	);

	const renderGrid = (gridFiles: MediaFile[], reviewPool = gridFiles) => (
		<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: spacing.lg }}>
			{gridFiles.map((file) => (
				<MediaCard
					key={file.id}
					file={file}
					cameraName={
						file.areaName
							? `${file.areaName} / ${siteNames.get(file.cameraSiteId || "") || "Unassigned camera"}`
							: siteNames.get(file.cameraSiteId || "")
					}
					deerNames={(file.knownDeerIds || []).map((id) => deerNames.get(id) || "Unknown deer")}
					onClick={() => startReview(reviewPool, file.id)}
				/>
			))}
		</div>
	);

	const renderGroupedGrid = (gridFiles: MediaFile[]) => {
		const groups = groupFilesByDate(gridFiles);
		if (groups.length <= 1) return renderGrid(gridFiles);
		return (
			<div style={{ display: "grid", gap: spacing.xxl }}>
				{groups.map((group) => (
					<section key={group.key} style={{ display: "grid", gap: spacing.md }}>
						<div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold }}>
							{group.label}
							<span style={{ marginLeft: spacing.sm, fontSize: typography.fontSize.xs, color: colors.textMuted, fontWeight: typography.fontWeight.medium }}>
								{group.files.length} file{group.files.length === 1 ? "" : "s"}
							</span>
						</div>
						{renderGrid(group.files, gridFiles)}
					</section>
				))}
			</div>
		);
	};

	const renderLocationFolder = (siteId: string, siteFiles: MediaFile[], onClick: () => void) => {
		const pending = siteFiles.filter(fileNeedsReview).length;
		const cover = siteFiles[0];
		return (
			<FolderCard
				key={siteId}
				title={siteLabel(siteId)}
				subtitle={siteAreaLabel(siteId)}
				meta={[
					siteFiles.length ? `${siteFiles.length} file${siteFiles.length === 1 ? "" : "s"}` : "No media yet",
					pending ? `${pending} need review` : null,
					latestDateLabel(siteFiles)
				]
					.filter(Boolean)
					.join(" · ")}
				preview={cover ? <MediaPreview file={cover} /> : undefined}
				onClick={onClick}
			/>
		);
	};

	const folderGridStyle: CSSProperties = {
		display: "grid",
		gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
		gap: spacing.lg
	};

	const pendingSiteIds = [...pendingBySiteId.keys()].sort((a, b) => siteLabel(a).localeCompare(siteLabel(b)));
	const showUnassignedFolder = unassignedFiles.length > 0;

	return (
		<div style={modalStyle} onClick={(event) => event.target === event.currentTarget && onClose()}>
			<div style={panelStyle}>
				<header
					style={{
						padding: `${spacing.xl} ${spacing.xxl}`,
						borderBottom: `1px solid ${colors.border}`,
						display: "flex",
						alignItems: "center",
						gap: spacing.md
					}}
				>
					<div style={{ flex: 1 }}>
						<div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold }}>Trail Camera Media</div>
						<div style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
							Browse camera locations, review new media, and track known deer.
						</div>
					</div>
					<button onClick={onOpenContent} style={buttonStyle}>Legacy library</button>
					<button onClick={onClose} style={buttonStyle}>Close</button>
				</header>

				{view !== "review" ? (
					<nav style={{ padding: `${spacing.md} ${spacing.xxl}`, borderBottom: `1px solid ${colors.border}`, display: "flex", gap: spacing.sm }}>
						{([
							["cameras", "Camera sites"],
							["deer", "Known deer"],
							["trash", `Trash${trashedFiles.length ? ` (${trashedFiles.length})` : ""}`]
						] as Array<[Exclude<ManagerView, "review">, string]>).map(([id, label]) => (
							<button
								key={id}
								onClick={() => {
									setView(id);
									if (id === "cameras") setCreatingSite(false);
									if (id === "deer") setDeerBrowse("home");
								}}
								style={{
									...buttonStyle,
									background: view === id ? colors.primaryLight : "transparent",
									borderColor: view === id ? colors.primaryBorder : "transparent"
								}}
							>
								{label}
							</button>
						))}
					</nav>
				) : null}

				{message ? (
					<div style={{ padding: `${spacing.md} ${spacing.xxl}`, background: colors.primaryLight, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
						{message}
					</div>
				) : null}

				<main style={{ flex: 1, overflow: "auto", padding: spacing.xxl }}>
					{loading ? <div>Loading media…</div> : null}

					{!loading && view === "cameras" ? (
						<div style={{ display: "grid", gap: spacing.xxl }}>
							<div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
								{crumbButton("Camera sites", cameraBrowse.level === "home" ? undefined : () => setCameraBrowse({ level: "home" }), cameraBrowse.level === "home")}
								{cameraBrowse.level === "needs-review" || cameraBrowse.level === "needs-review-site" ? (
									<>
										<span style={{ color: colors.textMuted }}>/</span>
										{crumbButton(
											"Needs review",
											cameraBrowse.level === "needs-review" ? undefined : () => setCameraBrowse({ level: "needs-review" }),
											cameraBrowse.level === "needs-review"
										)}
									</>
								) : null}
								{cameraBrowse.level === "site" || cameraBrowse.level === "needs-review-site" ? (
									<>
										<span style={{ color: colors.textMuted }}>/</span>
										{crumbButton(siteLabel(cameraBrowse.siteId), undefined, true)}
									</>
								) : null}
								<div style={{ marginLeft: "auto", display: "flex", gap: spacing.sm }}>
									{cameraBrowse.level === "home" ? (
										<button onClick={openCreateSite} style={primaryButtonStyle}>New camera site</button>
									) : null}
								</div>
							</div>

							{creatingSite && cameraBrowse.level === "home" ? (
								<div
									style={{
										display: "grid",
										gap: spacing.md,
										padding: spacing.xl,
										border: `1px solid ${colors.borderMedium}`,
										borderRadius: borderRadius.lg,
										background: colors.bgSecondary
									}}
								>
									<div style={{ fontWeight: typography.fontWeight.semibold }}>New camera site</div>
									<div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", alignItems: "end" }}>
										<label style={{ display: "grid", gap: spacing.xs, minWidth: 220 }}>
											<span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Location name</span>
											<input
												value={newSiteName}
												onChange={(event) => setNewSiteName(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === "Enter" && newSiteName.trim()) void handleCreateSite();
												}}
												placeholder="Oak Ridge, Food Plot, etc."
												style={inputStyle}
											/>
										</label>
										{properties.length > 1 ? (
											<label style={{ display: "grid", gap: spacing.xs, minWidth: 160 }}>
												<span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Property</span>
												<select
													value={newSitePropertyId}
													onChange={(event) => {
														const nextId = event.target.value;
														setNewSitePropertyId(nextId);
														const property = properties.find((item) => item.id === nextId);
														if (property && (!newSiteArea || newSiteArea === propertyNames.get(newSitePropertyId))) {
															setNewSiteArea(property.name);
														}
													}}
													style={inputStyle}
												>
													{properties.map((property) => (
														<option key={property.id} value={property.id}>
															{property.name}
														</option>
													))}
												</select>
											</label>
										) : null}
										<label style={{ display: "grid", gap: spacing.xs, minWidth: 160 }}>
											<span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Area</span>
											<input
												list="trail-camera-areas"
												value={newSiteArea}
												onChange={(event) => setNewSiteArea(event.target.value)}
												placeholder="Camp or Leacock"
												style={inputStyle}
											/>
										</label>
										<button
											onClick={() => void handleCreateSite()}
											disabled={!newSiteName.trim()}
											style={{ ...primaryButtonStyle, opacity: newSiteName.trim() ? 1 : 0.55 }}
										>
											Create site
										</button>
										<button
											onClick={() => setCreatingSite(false)}
											style={buttonStyle}
										>
											Cancel
										</button>
									</div>
								</div>
							) : null}

							{cameraBrowse.level === "home" ? (
								<div style={folderGridStyle}>
									<FolderCard
										title="Needs review"
										subtitle="Files that still need a classification"
										meta={`${reviewNeededFiles.length} file${reviewNeededFiles.length === 1 ? "" : "s"}`}
										accent="review"
										onClick={() => setCameraBrowse({ level: "needs-review" })}
									/>
									{showUnassignedFolder
										? renderLocationFolder(UNASSIGNED_SITE_ID, unassignedFiles, () =>
												setCameraBrowse({ level: "site", siteId: UNASSIGNED_SITE_ID })
										  )
										: null}
									{sites.map((site) =>
										renderLocationFolder(site.id, filesForSite(activeFiles, site.id), () =>
											setCameraBrowse({ level: "site", siteId: site.id })
										)
									)}
								</div>
							) : null}

							{cameraBrowse.level === "needs-review" ? (
								reviewNeededFiles.length ? (
									<div style={folderGridStyle}>
										{pendingSiteIds.map((siteId) =>
											renderLocationFolder(siteId, pendingBySiteId.get(siteId) || [], () =>
												setCameraBrowse({ level: "needs-review-site", siteId })
											)
										)}
									</div>
								) : (
									<div style={{ color: colors.textMuted }}>Everything is reviewed.</div>
								)
							) : null}

							{cameraBrowse.level === "site" || cameraBrowse.level === "needs-review-site" ? (
								<div style={{ display: "grid", gap: spacing.xxl }}>
									{cameraBrowse.level === "site" && selectedSite ? (
										<div style={{ display: "flex", gap: spacing.md, alignItems: "end", flexWrap: "wrap" }}>
											<label style={{ display: "grid", gap: spacing.xs, minWidth: 160 }}>
												<span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Area</span>
												<input
													list="trail-camera-areas"
													value={areaName}
													onChange={(event) => setAreaName(event.target.value)}
													onBlur={() => areaName.trim() && void saveCameraArea(areaName)}
													placeholder="Camp or Leacock"
													style={inputStyle}
												/>
											</label>
											<button
												onClick={() => void handleImport()}
												disabled={importing}
												style={{ ...primaryButtonStyle, opacity: importing ? 0.55 : 1 }}
											>
												{importing ? "Importing…" : "Import SD Card Folder"}
											</button>
											{visibleSiteFiles.some(fileNeedsReview) ? (
												<button
													onClick={() => startReview(visibleSiteFiles.filter(fileNeedsReview))}
													style={buttonStyle}
												>
													Review pending
												</button>
											) : null}
										</div>
									) : null}
									{cameraBrowse.level === "needs-review-site" && visibleSiteFiles.length ? (
										<div>
											<button
												onClick={() => startReview(visibleSiteFiles)}
												style={primaryButtonStyle}
											>
												Review {visibleSiteFiles.length} file{visibleSiteFiles.length === 1 ? "" : "s"}
											</button>
										</div>
									) : null}
									{importing && importProgress ? (
										<div style={{ display: "grid", gap: spacing.sm, maxWidth: 680 }}>
											<div style={{ display: "flex", justifyContent: "space-between", fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
												<span>{importProgress.stage === "converting" ? "Converting video" : "Importing folder"}: {importProgress.fileName || "Scanning…"}</span>
												<span>{importProgress.processed} / {importProgress.total}</span>
											</div>
											<div style={{ height: 8, borderRadius: borderRadius.full, background: colors.borderMedium, overflow: "hidden" }}>
												<div
													style={{
														height: "100%",
														width: `${importProgress.total ? Math.round((importProgress.processed / importProgress.total) * 100) : 0}%`,
														background: colors.primary,
														transition: "width 0.2s ease"
													}}
												/>
											</div>
											<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
												Large AVI cards can take a while because videos are converted for playback. Keep the SD card connected.
											</div>
										</div>
									) : null}
									{folders.length && selectedSite && cameraBrowse.level === "site" ? (
										<div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
											<select value={existingFolderId} onChange={(event) => setExistingFolderId(event.target.value)} style={{ ...inputStyle, minWidth: 240 }}>
												<option value="">Choose an existing My Content folder…</option>
												{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}
											</select>
											<button
												onClick={() => void linkExistingFolderToSite()}
												disabled={!existingFolderId}
												style={{ ...buttonStyle, opacity: existingFolderId ? 1 : 0.55 }}
											>
												Link folder to this site
											</button>
											<span style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>Links existing files in place; nothing is copied.</span>
										</div>
									) : null}

									<div style={{ display: "flex", gap: spacing.xxl, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
										<span>{visibleSiteFiles.length} media file{visibleSiteFiles.length === 1 ? "" : "s"}</span>
										<span>{visibleSiteFiles.filter(fileNeedsReview).length} need review</span>
										{selectedSite ? (
											<span>
												{importSessions.filter((session) => session.cameraSiteId === selectedSite.id).length} import session
												{importSessions.filter((session) => session.cameraSiteId === selectedSite.id).length === 1 ? "" : "s"}
											</span>
										) : (
											<span>Assign these files by opening them.</span>
										)}
									</div>

									{visibleSiteFiles.length ? (
										renderGroupedGrid(visibleSiteFiles)
									) : (
										<div style={{ color: colors.textMuted }}>
											{cameraBrowse.level === "needs-review-site"
												? "Nothing left to review for this location."
												: selectedSite
												? "No media imported for this camera site yet."
												: "No unassigned media."}
										</div>
									)}
								</div>
							) : null}

							<datalist id="trail-camera-areas">
								<option value="Camp" />
								<option value="Leacock" />
								{properties.map((property) => (
									<option key={property.id} value={property.name} />
								))}
							</datalist>
						</div>
					) : null}

					{!loading && view === "deer" ? (
						<div style={{ display: "grid", gap: spacing.xxl }}>
							<div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
								{crumbButton("Known deer", deerBrowse === "home" ? undefined : () => setDeerBrowse("home"), deerBrowse === "home")}
								{deerBrowse === "deer" && selectedDeerId ? (
									<>
										<span style={{ color: colors.textMuted }}>/</span>
										{crumbButton(deerNames.get(selectedDeerId) || "Deer", undefined, true)}
									</>
								) : null}
							</div>

							{deerBrowse === "home" ? (
								<>
									<div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center" }}>
										<input
											value={newDeerName}
											onChange={(event) => setNewDeerName(event.target.value)}
											placeholder="New deer name"
											style={{ ...inputStyle, minWidth: 200 }}
										/>
										<button onClick={() => void createKnownDeer()} disabled={!newDeerName.trim()} style={buttonStyle}>
											Add known deer
										</button>
										{folders.length ? (
											<>
												<select value={existingFolderId} onChange={(event) => setExistingFolderId(event.target.value)} style={inputStyle}>
													<option value="">Use existing folder…</option>
													{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}
												</select>
												<button onClick={() => void createDeerFromFolder()} disabled={!existingFolderId} style={buttonStyle}>
													Create deer from folder
												</button>
											</>
										) : null}
									</div>
									{knownDeer.length ? (
										<div style={folderGridStyle}>
											{knownDeer.map((deer) => {
												const deerFiles = sortByDate(activeFiles.filter((file) => file.knownDeerIds?.includes(deer.id)));
												const cover = deerFiles[0];
												return (
													<FolderCard
														key={deer.id}
														title={deer.name}
														meta={[
															`${deerFiles.length} appearance${deerFiles.length === 1 ? "" : "s"}`,
															latestDateLabel(deerFiles)
														]
															.filter(Boolean)
															.join(" · ")}
														preview={cover ? <MediaPreview file={cover} /> : <div style={{ fontSize: 36 }}>🦌</div>}
														onClick={() => {
															setSelectedDeerId(deer.id);
															setDeerBrowse("deer");
														}}
													/>
												);
											})}
										</div>
									) : (
										<div style={{ color: colors.textMuted }}>Add a known deer to start its folder and timeline.</div>
									)}
								</>
							) : (
								<section>
									<div style={{ marginBottom: spacing.xl, color: colors.textMuted, fontSize: typography.fontSize.sm }}>
										{selectedDeerFiles.length} appearance{selectedDeerFiles.length === 1 ? "" : "s"} across camera sites
									</div>
									{selectedDeerFiles.length ? renderGroupedGrid(selectedDeerFiles) : <div>No media tagged to this deer yet.</div>}
								</section>
							)}
						</div>
					) : null}

					{!loading && view === "trash" ? (
						<div style={{ display: "grid", gap: spacing.lg }}>
							<div style={{ color: colors.textMuted, fontSize: typography.fontSize.sm }}>
								Blank and misfire files are hidden from normal views but kept safely on disk. Restore keeps their camera and review metadata. Restoring does not put a deleted original back on the SD card.
							</div>
							{trashedFiles.map((file) => (
								<div key={file.id} style={{ display: "flex", alignItems: "center", gap: spacing.lg, padding: spacing.md, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg }}>
									<div style={{ width: 100, height: 70, overflow: "hidden", borderRadius: borderRadius.md }}><MediaPreview file={file} /></div>
									<div style={{ flex: 1 }}>
										<div style={{ fontWeight: typography.fontWeight.semibold }}>{file.name}</div>
										<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
											{siteNames.get(file.cameraSiteId || "") || "Unknown camera"}
											{" · "}
											{formatCaptureDateTime(file.capturedAt || file.trashedAt)}
										</div>
									</div>
									<button onClick={() => void restoreFile(file)} style={buttonStyle}>Restore</button>
								</div>
							))}
							{!trashedFiles.length ? <div>Trash is empty.</div> : null}
						</div>
					) : null}

					{view === "review" ? (
						<div style={{ height: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 0.7fr)", gap: spacing.xxl }}>
							<section style={{ minHeight: 420, background: "#111", borderRadius: borderRadius.lg, overflow: "hidden" }}>
								{currentReviewFile ? <MediaPreview file={currentReviewFile} large /> : (
									<div style={{ height: "100%", display: "grid", placeItems: "center", color: "#fff" }}>Review complete</div>
								)}
							</section>
							<aside style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
								<div>
									<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
										{Math.min(reviewIndex + 1, reviewFiles.length)} of {reviewFiles.length}
									</div>
									<div style={{ fontWeight: typography.fontWeight.semibold, marginTop: spacing.xs }}>
										{currentReviewFile?.name || "All files reviewed"}
									</div>
									{currentReviewFile ? (
										<div style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
											{formatCaptureDateTime(currentReviewFile.capturedAt || currentReviewFile.createdAt)}
										</div>
									) : null}
								</div>

								{currentReviewFile ? (
									<>
										<div style={{ padding: spacing.md, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg, display: "grid", gap: spacing.sm }}>
											<div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Camera location</div>
											<select
												value={currentReviewFile.cameraSiteId || ""}
												onChange={(event) => void assignCurrentCamera(event.target.value)}
												style={inputStyle}
											>
												<option value="">Choose camera…</option>
												{sites.map((site) => (
													<option key={site.id} value={site.id}>
														{site.areaName || propertyNames.get(site.propertyId || "") || "Property"} / {site.name}
													</option>
												))}
											</select>
											<div style={{ marginTop: spacing.sm, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>Known deer in this file</div>
											{knownDeer.length ? (
												<div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
													{knownDeer.map((deer) => {
														const checked = currentReviewFile.knownDeerIds?.includes(deer.id) || false;
														return (
															<label
																key={deer.id}
																style={{
																	display: "flex",
																	alignItems: "center",
																	gap: spacing.xs,
																	padding: `${spacing.xs} ${spacing.sm}`,
																	borderRadius: borderRadius.full,
																	border: `1px solid ${checked ? colors.primaryBorder : colors.borderMedium}`,
																	background: checked ? colors.primaryLight : colors.bgButton,
																	fontSize: typography.fontSize.sm,
																	cursor: "pointer"
																}}
															>
																<input type="checkbox" checked={checked} onChange={() => void toggleCurrentDeer(deer.id)} />
																{deer.name}
															</label>
														);
													})}
												</div>
											) : (
												<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>No known deer created yet.</div>
											)}
											<div style={{ display: "flex", gap: spacing.sm }}>
												<input value={newDeerName} onChange={(event) => setNewDeerName(event.target.value)} placeholder="Or add a new deer" style={{ ...inputStyle, flex: 1 }} />
												<button
													onClick={async () => {
														const deerId = await createKnownDeer();
														if (deerId) await assignCurrentDeer(deerId);
													}}
													disabled={!newDeerName.trim()}
													style={buttonStyle}
												>
													Add & tag
												</button>
											</div>
											<button
												onClick={() => void classifyCurrent("known_buck")}
												disabled={!(currentReviewFile.knownDeerIds || []).length}
												style={{
													...primaryButtonStyle,
													opacity: (currentReviewFile.knownDeerIds || []).length ? 1 : 0.55
												}}
											>
												Keep known buck & next<span style={shortcutHintStyle}>5</span>
											</button>
										</div>
										<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm }}>
											<button onClick={() => void classifyCurrent("unknown_buck")} style={buttonStyle}>
												Unknown buck<span style={shortcutHintStyle}>3</span>
											</button>
											<button onClick={() => void classifyCurrent("doe")} style={buttonStyle}>
												Doe<span style={shortcutHintStyle}>2</span>
											</button>
											<button onClick={() => void classifyCurrent("other_animal")} style={buttonStyle}>
												Other animal<span style={shortcutHintStyle}>4</span>
											</button>
											<button onClick={() => void classifyCurrent("blank")} style={{ ...buttonStyle, color: colors.error }}>
												Blank / misfire<span style={shortcutHintStyle}>1</span>
											</button>
											<div style={{ gridColumn: "1 / -1", fontSize: typography.fontSize.xs, color: colors.textMuted }}>
												{currentReviewFile.sourceDeletedAt
													? "SD card original already deleted."
													: currentReviewFile.sourcePath || currentReviewFile.sourceRelativePath
													? "Blank / misfire also deletes the original on the SD card if the card is still connected."
													: "No SD card original is recorded for this file."}
											</div>
											<div style={{ gridColumn: "1 / -1", fontSize: typography.fontSize.xs, color: colors.textMuted }}>
												Keys: 1 misfire · 2 doe · 3 unknown buck · 4 other · 5 known buck · ← → skip · Esc exit
											</div>
										</div>
									</>
								) : (
									<button onClick={() => void finishReview()} style={primaryButtonStyle}>
										Finish review and move blanks to Trash<span style={shortcutHintStyle}>Enter</span>
									</button>
								)}
								<button onClick={() => setView(reviewReturnView)} style={{ ...buttonStyle, marginTop: "auto" }}>
									Exit review<span style={shortcutHintStyle}>Esc</span>
								</button>
							</aside>
						</div>
					) : null}
				</main>
			</div>
		</div>
	);
}
