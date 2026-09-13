import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import useAppStore from "../../state/store";
import {
	fileNeedsCamera,
	fileNeedsIdentity,
	fileNeedsReview,
	formatReviewNeeds,
	useMediaStore,
	type KnownDeer,
	type MediaClassification,
	type MediaFile,
	type ReviewNeed,
	type StoredCameraSite
} from "../../state/media";
import {
	createCameraSite,
	loadCameraSites,
	updateCameraSiteArea,
	type CameraSite
} from "../../lib/media/cameraSites";
import { borderRadius, colors, spacing, typography } from "../../lib/theme";
import {
	classificationLabels,
	describeMediaDuplicate,
	findCatalogMatch,
	findCatalogMatchForFingerprint,
	findDuplicatePeers,
	findExistingForMatch,
	warningsFromMatches,
	ensureMediaFingerprints,
	reconcileDuplicateCopies,
	restoreBlankKeepers,
	type DuplicateWarning
} from "../../lib/media/duplicates";
import DuplicateWarningList from "./DuplicateWarningList";
import { groupFilesByDate } from "../../lib/media/timeline";

type ManagerView = "cameras" | "deer" | "trash" | "review";
type CameraBrowse =
	| { level: "home" }
	| { level: "needs-review" }
	| { level: "site"; siteId: string }
	| { level: "needs-review-site"; siteId: string }
	| { level: "needs-review-reason"; reason: ReviewNeed };

type TrailCameraMediaManagerProps = {
	onClose: () => void;
	initialCameraName?: string | null;
	initialCameraSiteId?: string | null;
};

type ReviewUndo = {
	fileIndex: number;
	sdDeleted: boolean;
	files: Array<{
		id: string;
		classification: MediaFile["classification"];
		reviewStatus: MediaFile["reviewStatus"];
		knownDeerIds: string[] | undefined;
		cameraSiteId: string | undefined;
		propertyId: string | undefined;
		areaName: string | undefined;
		trashedAt: string | undefined;
		sourceDeletedAt: string | undefined;
	}>;
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

const kbdStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: 22,
	height: 20,
	padding: "0 6px",
	borderRadius: 4,
	border: "1px solid rgba(255,255,255,0.28)",
	background: "rgba(0,0,0,0.45)",
	color: "#fff",
	fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
	fontSize: 11,
	fontWeight: 700,
	lineHeight: 1,
	letterSpacing: 0
};

const sidebarKbdStyle: CSSProperties = {
	...kbdStyle,
	border: `1px solid ${colors.borderMedium}`,
	background: colors.bgButton,
	color: colors.textPrimary
};

function HotkeyKeys({ keys, onPhoto }: { keys: string[]; onPhoto?: boolean }) {
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
			{keys.map((key) => (
				<kbd key={key} style={onPhoto ? kbdStyle : sidebarKbdStyle}>
					{key}
				</kbd>
			))}
		</span>
	);
}

function ReviewHotkeyLegend({ finished, onPhoto }: { finished: boolean; onPhoto?: boolean }) {
	const rows = finished
		? [
				{ keys: ["Z"], label: "Undo last tag" },
				{ keys: ["Enter"], label: "Finish & move blanks to Trash" },
				{ keys: ["Esc"], label: "Back" }
			]
		: [
				{ keys: ["1", "X"], label: "Blank / misfire" },
				{ keys: ["2", "D"], label: "Doe" },
				{ keys: ["3", "U"], label: "Unknown buck" },
				{ keys: ["4", "O"], label: "Other animal" },
				{ keys: ["5", "K"], label: "Known buck" },
				{ keys: ["6", "S"], label: "Scrub buck" },
				{ keys: ["Z"], label: "Undo last tag" },
				{ keys: ["←", "→"], label: "Skip / go back" },
				{ keys: ["Esc"], label: "Back" }
			];

	if (onPhoto) {
		return (
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 0,
					padding: `${spacing.md} ${spacing.lg} ${spacing.xxl}`,
					background: "linear-gradient(rgba(0,0,0,0.82), transparent)",
					color: "#fff",
					pointerEvents: "none"
				}}
			>
				<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, marginBottom: 8 }}>
					Hotkeys
				</div>
				<div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", alignItems: "center" }}>
					{rows.map((row) => (
						<span key={row.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
							<HotkeyKeys keys={row.keys} onPhoto />
							<span style={{ opacity: 0.92 }}>{row.label}</span>
						</span>
					))}
				</div>
			</div>
		);
	}

	return (
		<div
			style={{
				padding: spacing.md,
				border: `1px solid ${colors.borderMedium}`,
				borderRadius: borderRadius.lg,
				background: colors.bgSecondary,
				display: "grid",
				gap: spacing.sm
			}}
		>
			<div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, letterSpacing: "0.06em", textTransform: "uppercase" }}>
				Hotkeys
			</div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: `${spacing.sm} ${spacing.lg}` }}>
				{rows.map((row) => (
					<span key={row.label} style={{ display: "inline-flex", alignItems: "center", gap: spacing.sm, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
						<HotkeyKeys keys={row.keys} />
						{row.label}
					</span>
				))}
			</div>
		</div>
	);
}

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
		if (!large) {
			return (
				<div
					aria-label={file.name}
					style={{
						width: "100%",
						height: "100%",
						display: "grid",
						placeItems: "center",
						background: "#111",
						color: "#fff",
						fontSize: 22
					}}
				>
					▶
				</div>
			);
		}
		return (
			<video
				key={file.id}
				src={url}
				controls
				preload="auto"
				playsInline
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
	selected,
	onToggleSelect,
	onClick
}: {
	file: MediaFile;
	cameraName?: string;
	deerNames: string[];
	selected?: boolean;
	onToggleSelect?: (id: string) => void;
	onClick: () => void;
}) {
	const needed = formatReviewNeeds(file);
	return (
		<div
			style={{
				position: "relative",
				borderRadius: borderRadius.lg,
				border: `1px solid ${selected ? colors.primaryBorder : colors.borderMedium}`,
				background: selected ? colors.primaryLight : colors.bgPanelSolid,
				overflow: "hidden",
				color: colors.textPrimary
			}}
		>
			{onToggleSelect ? (
				<label
					style={{
						position: "absolute",
						top: 8,
						left: 8,
						zIndex: 2,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: 24,
						height: 24,
						borderRadius: 6,
						background: "rgba(0,0,0,0.55)",
						cursor: "pointer"
					}}
				>
					<input
						type="checkbox"
						checked={Boolean(selected)}
						onChange={() => onToggleSelect(file.id)}
						aria-label={`Select ${file.name}`}
					/>
				</label>
			) : null}
			<button
				type="button"
				onClick={onClick}
				style={{
					display: "block",
					width: "100%",
					textAlign: "left",
					padding: 0,
					border: "none",
					background: "transparent",
					cursor: "pointer",
					color: "inherit"
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
						{file.classification ? classificationLabels[file.classification] : "Unclassified"}
						{deerNames.length ? ` · ${deerNames.join(", ")}` : ""}
					</div>
					{needed ? (
						<div style={{ fontSize: typography.fontSize.xs, color: colors.primary, fontWeight: typography.fontWeight.semibold }}>
							Needs {needed}
						</div>
					) : null}
				</div>
			</button>
		</div>
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
	initialCameraName,
	initialCameraSiteId
}: TrailCameraMediaManagerProps) {
	const { projectPath, activePropertyId, properties } = useAppStore();
	const {
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
	const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
	const [reviewIds, setReviewIds] = useState<string[]>([]);
	const [reviewIndex, setReviewIndex] = useState(0);
	const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
	const [bulkSiteId, setBulkSiteId] = useState("");
	const [areaName, setAreaName] = useState("");
	const [creatingSite, setCreatingSite] = useState(false);
	const [newSiteName, setNewSiteName] = useState("");
	const [newSitePropertyId, setNewSitePropertyId] = useState("");
	const [newSiteArea, setNewSiteArea] = useState("");
	const [sdDeleteStats, setSdDeleteStats] = useState({ deleted: 0, missing: 0, failed: 0 });
	const [duplicateReport, setDuplicateReport] = useState<DuplicateWarning[]>([]);
	const reviewIndexRef = useRef(0);
	const reviewIdsRef = useRef<string[]>([]);
	const selectedDeerIdRef = useRef("");
	const undoStackRef = useRef<ReviewUndo[]>([]);

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
				const catalog = useMediaStore.getState().files;
				if (!cancelled && projectPath && catalog.length) {
					let dirty = false;
					await ensureMediaFingerprints(projectPath, catalog, (updates) => {
						if (updates.length) dirty = true;
						updateFiles(updates);
					});
					if (cancelled) return;
					const duplicateFixes = reconcileDuplicateCopies(useMediaStore.getState().files);
					if (duplicateFixes.length) {
						updateFiles(duplicateFixes);
						dirty = true;
						const restoredCount = duplicateFixes.filter((item) => item.changes.reviewStatus === "pending").length;
						if (restoredCount) {
							setMessage(
								`Kept one copy of each duplicate. Put ${restoredCount} blank duplicate${restoredCount === 1 ? "" : "s"} back in Needs review; extra copies stay in Trash.`
							);
						}
					}
					if (dirty) await saveToProject(projectPath);
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
	const browsingUnassigned = browsingSiteId === UNASSIGNED_SITE_ID;
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
	const filesNeedingCamera = useMemo(() => sortByDate(activeFiles.filter(fileNeedsCamera)), [activeFiles]);
	const filesNeedingIdentity = useMemo(
		() => sortByDate(activeFiles.filter(fileNeedsIdentity)),
		[activeFiles]
	);
	const visibleSiteFiles = useMemo(() => {
		if (cameraBrowse.level === "needs-review-reason") {
			return cameraBrowse.reason === "camera" ? filesNeedingCamera : filesNeedingIdentity;
		}
		if (cameraBrowse.level === "needs-review-site") {
			return selectedSiteFiles.filter(fileNeedsReview);
		}
		if (cameraBrowse.level === "site") {
			return selectedSiteFiles;
		}
		return [];
	}, [cameraBrowse, filesNeedingCamera, filesNeedingIdentity, selectedSiteFiles]);
	const showingFileBrowser =
		cameraBrowse.level === "site" ||
		cameraBrowse.level === "needs-review-site" ||
		cameraBrowse.level === "needs-review-reason";
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
	const currentFileDuplicates = useMemo(() => {
		if (!currentReviewFile) return [];
		return findDuplicatePeers(files, currentReviewFile).map((existing) =>
			describeMediaDuplicate(existing, currentReviewFile.name, sites, propertyNames)
		);
	}, [currentReviewFile, files, sites, propertyNames]);

	useEffect(() => {
		reviewIndexRef.current = reviewIndex;
	}, [reviewIndex]);
	useEffect(() => {
		reviewIdsRef.current = reviewIds;
	}, [reviewIds]);
	useEffect(() => {
		selectedDeerIdRef.current = selectedDeerId;
	}, [selectedDeerId]);
	useEffect(() => {
		setSelectedFileIds([]);
		setBulkSiteId("");
	}, [cameraBrowse, view]);
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
		await persist();
		return deer.id;
	};

	const persist = async () => {
		if (!projectPath) return;
		setSaveState("saving");
		try {
			await saveToProject(projectPath);
			setSaveState("saved");
		} catch (error) {
			console.error("Failed to save media catalog", error);
			setSaveState("idle");
			setMessage("Could not save. Try that action again.");
		}
	};

	const applyDuplicateKeepers = (keepers: Array<MediaFile | undefined>): MediaFile[] => {
		const restores = restoreBlankKeepers(keepers.filter((file): file is MediaFile => Boolean(file)));
		if (restores.length) updateFiles(restores);
		const recon = reconcileDuplicateCopies(useMediaStore.getState().files);
		if (recon.length) updateFiles(recon);
		const catalog = useMediaStore.getState().files;
		return restores.flatMap((update) => {
			const file = catalog.find((item) => item.id === update.id);
			return file && fileNeedsReview(file) ? [file] : [];
		});
	};

	const snapshotCurrent = (): ReviewUndo | null => {
		const id = reviewIdsRef.current[reviewIndexRef.current];
		if (!id) return null;
		const file = useMediaStore.getState().files.find((item) => item.id === id);
		if (!file) return null;
		return {
			fileIndex: reviewIndexRef.current,
			sdDeleted: false,
			files: [
				{
					id,
					classification: file.classification,
					reviewStatus: file.reviewStatus,
					knownDeerIds: file.knownDeerIds,
					cameraSiteId: file.cameraSiteId,
					propertyId: file.propertyId,
					areaName: file.areaName,
					trashedAt: file.trashedAt,
					sourceDeletedAt: file.sourceDeletedAt
				}
			]
		};
	};

	const pushUndo = (entry: ReviewUndo) => {
		undoStackRef.current = [...undoStackRef.current.slice(-19), entry];
	};

	const startReview = (siteFiles: MediaFile[], startId?: string) => {
		const ids = siteFiles.map((file) => file.id);
		const nextIndex = Math.max(0, startId ? ids.indexOf(startId) : 0);
		reviewIdsRef.current = ids;
		reviewIndexRef.current = nextIndex;
		undoStackRef.current = [];
		setReviewReturnView(view === "deer" ? "deer" : "cameras");
		setReviewIds(ids);
		setReviewIndex(nextIndex);
		setSdDeleteStats({ deleted: 0, missing: 0, failed: 0 });
		setView("review");
	};

	const openDuplicateCopy = (fileId: string) => {
		const file = useMediaStore.getState().files.find((item) => item.id === fileId);
		if (!file || file.trashedAt) return;
		const existingIndex = reviewIdsRef.current.indexOf(fileId);
		if (view === "review" && existingIndex >= 0) {
			reviewIndexRef.current = existingIndex;
			setReviewIndex(existingIndex);
			return;
		}
		startReview([file], file.id);
	};

	const leaveReview = () => {
		setView(reviewReturnView);
	};

	const undoLastReviewAction = async () => {
		const entry = undoStackRef.current.pop();
		if (!entry || !projectPath) return;
		reviewIndexRef.current = entry.fileIndex;
		setReviewIndex(entry.fileIndex);
		updateFiles(
			entry.files.map((file) => ({
				id: file.id,
				changes: {
					classification: file.classification,
					reviewStatus: file.reviewStatus,
					knownDeerIds: file.knownDeerIds,
					cameraSiteId: file.cameraSiteId,
					propertyId: file.propertyId,
					areaName: file.areaName,
					trashedAt: file.trashedAt,
					sourceDeletedAt: file.sourceDeletedAt
				}
			}))
		);
		await persist();
		setMessage(
			entry.sdDeleted
				? "Undid the last tag. The SD card original could not be restored."
				: "Undid the last tag."
		);
	};

	const cameraAssignment = (cameraSiteId: string): Partial<MediaFile> => {
		if (!cameraSiteId) {
			return { cameraSiteId: undefined, propertyId: undefined, areaName: undefined };
		}
		const site = sites.find((item) => item.id === cameraSiteId);
		if (!site) return {};
		const nextArea =
			site.areaName ||
			(site.propertyId === "camp" ? "Camp" : propertyNames.get(site.propertyId || "") || undefined);
		return {
			cameraSiteId: site.id,
			propertyId: site.propertyId || undefined,
			areaName: nextArea
		};
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
		await persist();
		setMessage(`Camera area set to ${nextAreaName.trim()}.`);
	};

	const assignCurrentCamera = async (cameraSiteId: string) => {
		if (!projectPath || !currentReviewFile) return;
		const undo = snapshotCurrent();
		if (undo) pushUndo(undo);
		updateFile(currentReviewFile.id, cameraAssignment(cameraSiteId));
		await persist();
	};

	const assignSelectedCamera = async () => {
		if (!projectPath || !bulkSiteId || !selectedFileIds.length) return;
		const changes = cameraAssignment(bulkSiteId);
		if (!changes.cameraSiteId) return;
		updateFiles(selectedFileIds.map((id) => ({ id, changes })));
		await persist();
		setMessage(`Assigned ${selectedFileIds.length} file(s) to ${siteLabel(bulkSiteId)}.`);
		setSelectedFileIds([]);
	};

	const toggleCurrentDeer = async (deerId: string) => {
		if (!projectPath || !currentReviewFile) return;
		const currentIds = currentReviewFile.knownDeerIds || [];
		const nextIds = currentIds.includes(deerId)
			? currentIds.filter((id) => id !== deerId)
			: [...currentIds, deerId];
		const undo = snapshotCurrent();
		if (undo) pushUndo(undo);
		updateFile(currentReviewFile.id, {
			knownDeerIds: nextIds,
			classification: nextIds.length
				? "known_buck"
				: currentReviewFile.classification === "known_buck"
				? "unknown_buck"
				: currentReviewFile.classification
		});
		await persist();
	};

	const assignCurrentDeer = async (deerId: string) => {
		if (!projectPath || !currentReviewFile) return;
		const currentIds = currentReviewFile.knownDeerIds || [];
		if (currentIds.includes(deerId)) return;
		const undo = snapshotCurrent();
		if (undo) pushUndo(undo);
		updateFile(currentReviewFile.id, {
			knownDeerIds: Array.from(new Set([...currentIds, deerId])),
			classification: "known_buck"
		});
		await persist();
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
			await persist();
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
		setDuplicateReport([]);
		setMessage("Indexing existing media for duplicate detection…");
		try {
			const known = await ensureMediaFingerprints(projectPath, files, updateFiles);
			if (files.some((file) => !file.sha256 && !file.trashedAt)) {
				await persist();
			}
			setMessage("Copying media and checking for duplicates…");
			const result = await window.api.importTrailCameraMedia(
				projectPath,
				sourceFolder,
				targetFolder,
				known
			);
			const now = new Date().toISOString();
			const importedFiles: MediaFile[] = result.files.map((file) => ({
				id: createId("file"),
				name: file.name,
				path: file.path,
				type: file.type,
				sha256: file.sha256,
				storedSha256: file.storedSha256,
				payloadSha256: file.payloadSha256,
				originalName: file.originalName,
				captureTime: file.captureTime,
				captureSubsec: file.captureSubsec,
				cameraMake: file.cameraMake,
				cameraModel: file.cameraModel,
				width: file.width,
				height: file.height,
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
			const catalog = useMediaStore.getState().files;
			const restored = applyDuplicateKeepers(
				(result.duplicateMatches || []).map((match) => findExistingForMatch(catalog, match))
			);
			const warnings = warningsFromMatches(
				result.duplicateMatches || [],
				useMediaStore.getState().files,
				sites,
				propertyNames
			);
			setDuplicateReport(warnings);
			await persist();
			setMessage(
				`Imported ${importedFiles.length} file(s). Skipped ${result.skippedDuplicates} extra cop${result.skippedDuplicates === 1 ? "y" : "ies"}` +
					(restored.length ? `; put ${restored.length} blank duplicate${restored.length === 1 ? "" : "s"} back in Needs review` : "") +
					(result.failedFiles.length ? `; ${result.failedFiles.length} failed.` : ".")
			);
			if (importedFiles.length) startReview([...importedFiles, ...restored]);
			else if (restored.length) startReview(restored);
		} catch (error) {
			console.error("Trail camera import failed", error);
			setMessage("Import failed. The source files were not changed.");
		} finally {
			setImporting(false);
			setImportProgress(null);
		}
	};

	const handleUploadFiles = async () => {
		if (!projectPath || cameraBrowse.level !== "site") return;
		const selectedFiles = await window.api.chooseFiles([
			{ name: "All Media Files", extensions: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "mp4", "mov", "avi", "mkv", "webm", "m4v"] },
			{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"] },
			{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm", "m4v"] },
			{ name: "All Files", extensions: ["*"] }
		]);
		if (!selectedFiles?.length) return;

		const datePart = new Date().toISOString().slice(0, 10);
		const importArea =
			areaName ||
			selectedSite?.areaName ||
			propertyNames.get(selectedSite?.propertyId || "") ||
			"Property";
		const targetFolder = selectedSite
			? `${safePathPart(importArea)}/cameras/${safePathPart(selectedSite.name)}/${datePart}_upload`
			: `unassigned/${datePart}`;

		setDuplicateReport([]);
		setMessage("Checking for duplicates…");
		try {
			const known = await ensureMediaFingerprints(projectPath, files, updateFiles);
			const catalog = useMediaStore.getState().files;
			const inspected =
				typeof window.api.inspectExternalFiles === "function"
					? await window.api.inspectExternalFiles(selectedFiles)
					: [];
			const fingerprintByPath = new Map(inspected.map((item) => [item.path, item]));
			const seenHashes = new Set(known.hashes);
			const importedFiles: MediaFile[] = [];
			const skipped: Array<{ existing?: MediaFile; sourceName: string }> = [];
			const failed: string[] = [];
			const now = new Date().toISOString();

			for (const absPath of selectedFiles) {
				const originalFileName = absPath.split(/[/\\]/).pop() || "";
				const isVideo = /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(originalFileName);
				const isImage = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(originalFileName);
				if (!isVideo && !isImage) continue;
				try {
					const fingerprint = fingerprintByPath.get(absPath);
					const existing = fingerprint
						? findCatalogMatchForFingerprint(catalog, fingerprint, known)
						: undefined;
					const hashHit = fingerprint?.sha256 && seenHashes.has(fingerprint.sha256);
					if (existing || hashHit) {
						skipped.push({
							existing: existing || (fingerprint?.sha256 ? findCatalogMatch(catalog, fingerprint.sha256) : undefined),
							sourceName: originalFileName
						});
						continue;
					}
					const copiedRelPath = await window.api.copyToMedia(projectPath, absPath, targetFolder);
					const pathWithoutMedia = copiedRelPath.startsWith("media/")
						? copiedRelPath.slice(6)
						: copiedRelPath;
					const stored =
						typeof window.api.inspectMediaFiles === "function"
							? (await window.api.inspectMediaFiles(projectPath, [pathWithoutMedia]))[0]
							: undefined;
					if (stored?.sha256 && seenHashes.has(stored.sha256)) {
						const match = findCatalogMatch(catalog, stored.sha256);
						skipped.push({ existing: match, sourceName: originalFileName });
						continue;
					}
					const mediaFile: MediaFile = {
						id: createId("file"),
						name: pathWithoutMedia.split("/").pop() || originalFileName,
						path: pathWithoutMedia,
						type: isVideo ? "video" : "image",
						sha256: fingerprint?.sha256 || stored?.sha256,
						storedSha256: stored?.sha256 || fingerprint?.sha256,
						payloadSha256: fingerprint?.payloadSha256 || stored?.payloadSha256,
						originalName: fingerprint?.originalName || originalFileName,
						captureTime: fingerprint?.captureTime || stored?.captureTime,
						captureSubsec: fingerprint?.captureSubsec || stored?.captureSubsec,
						cameraMake: fingerprint?.cameraMake || stored?.cameraMake,
						cameraModel: fingerprint?.cameraModel || stored?.cameraModel,
						width: fingerprint?.width || stored?.width,
						height: fingerprint?.height || stored?.height,
						propertyId: selectedSite?.propertyId || undefined,
						areaName: selectedSite ? importArea : undefined,
						cameraSiteId: selectedSite?.id,
						reviewStatus: "pending",
						knownDeerIds: [],
						sourcePath: absPath,
						capturedAt: fingerprint?.captureTime || stored?.captureTime,
						createdAt: now,
						updatedAt: now
					};
					importedFiles.push(mediaFile);
					for (const hash of [mediaFile.sha256, mediaFile.storedSha256, mediaFile.payloadSha256]) {
						if (hash) seenHashes.add(hash);
					}
				} catch (error) {
					console.error("[upload] Failed to import", absPath, error);
					failed.push(originalFileName);
				}
			}

			if (importedFiles.length) addFiles(importedFiles);
			const restored = applyDuplicateKeepers(skipped.map((item) => item.existing));
			const latest = useMediaStore.getState().files;
			const dupes: DuplicateWarning[] = skipped.flatMap((item) => {
				const existing = item.existing
					? latest.find((file) => file.id === item.existing?.id) || item.existing
					: undefined;
				return existing ? [describeMediaDuplicate(existing, item.sourceName, sites, propertyNames)] : [];
			});
			setDuplicateReport(dupes);
			await persist();
			setMessage(
				`Uploaded ${importedFiles.length} file(s)` +
					(dupes.length ? `. Skipped ${dupes.length} extra cop${dupes.length === 1 ? "y" : "ies"}` : "") +
					(restored.length ? `; put ${restored.length} blank duplicate${restored.length === 1 ? "" : "s"} back in Needs review` : "") +
					(failed.length ? `; ${failed.length} failed` : ".")
			);
			if (importedFiles.length) startReview([...importedFiles, ...restored]);
			else if (restored.length) startReview(restored);
		} catch (error) {
			console.error("Upload failed", error);
			setMessage("Upload failed. The source files were not changed.");
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
		const undo = snapshotCurrent();
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
				if (undo) undo.sdDeleted = true;
				setSdDeleteStats((current) => ({ ...current, deleted: current.deleted + 1 }));
			} else if (sdStatus === "missing") {
				setSdDeleteStats((current) => ({ ...current, missing: current.missing + 1 }));
			} else if (sdStatus === "failed") {
				setSdDeleteStats((current) => ({ ...current, failed: current.failed + 1 }));
			}
		}
		if (undo) pushUndo(undo);
		updateFile(file.id, changes);
		reviewIndexRef.current = index + 1;
		setReviewIndex(index + 1);
		await persist();
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
		const reviewedIds = new Set(reviewIds);
		const blankFiles = stateFiles.filter(
			(file) => reviewedIds.has(file.id) && file.classification === "blank" && !file.trashedAt
		);
		const trashedAt = new Date().toISOString();
		const changes = blankFiles.map((file) => ({
			id: file.id,
			changes: { trashedAt }
		}));
		if (changes.length) updateFiles(changes);
		await persist();
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
		undoStackRef.current = [];
	};

	useEffect(() => {
		if (view !== "review") return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTypingTarget(event.target)) return;
			const key = event.key;
			if (key === "Escape") {
				event.preventDefault();
				leaveReview();
				return;
			}
			if (key === "z" || key === "Z") {
				event.preventDefault();
				void undoLastReviewAction();
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
			if (key === "6" || key === "s" || key === "S") {
				event.preventDefault();
				void classifyCurrent("scrub_buck");
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
	}, [view, reviewReturnView, classifyCurrent, finishReview, leaveReview, undoLastReviewAction]);

	const restoreFile = async (file: MediaFile) => {
		if (!projectPath) return;
		if (file.duplicateOfId) {
			const keeper = useMediaStore.getState().files.find((item) => item.id === file.duplicateOfId);
			if (keeper && !keeper.trashedAt) {
				setMessage("This is an extra copy. TrueMap already kept the other file in your library.");
				return;
			}
		}
		updateFile(file.id, { trashedAt: undefined, duplicateOfId: undefined });
		await persist();
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

	const toggleSelectedFile = (id: string) => {
		setSelectedFileIds((current) =>
			current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
		);
	};

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
					selected={selectedFileIds.includes(file.id)}
					onToggleSelect={view === "cameras" && showingFileBrowser ? toggleSelectedFile : undefined}
					onClick={() => startReview(reviewPool, file.id)}
				/>
			))}
		</div>
	);

	const renderBulkCameraBar = (gridFiles: MediaFile[]) => (
		<div
			style={{
				display: "flex",
				gap: spacing.sm,
				alignItems: "center",
				flexWrap: "wrap",
				padding: spacing.md,
				border: `1px solid ${colors.borderMedium}`,
				borderRadius: borderRadius.lg,
				background: colors.bgSecondary
			}}
		>
			<button
				onClick={() => setSelectedFileIds(gridFiles.map((file) => file.id))}
				disabled={!gridFiles.length}
				style={buttonStyle}
			>
				Select all
			</button>
			<button
				onClick={() => setSelectedFileIds([])}
				disabled={!selectedFileIds.length}
				style={{ ...buttonStyle, opacity: selectedFileIds.length ? 1 : 0.55 }}
			>
				Clear
			</button>
			<span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
				{selectedFileIds.length} selected
			</span>
			<select
				value={bulkSiteId}
				onChange={(event) => setBulkSiteId(event.target.value)}
				style={{ ...inputStyle, minWidth: 220 }}
			>
				<option value="">Assign camera site…</option>
				{sites.map((site) => (
					<option key={site.id} value={site.id}>
						{site.areaName || propertyNames.get(site.propertyId || "") || "Property"} / {site.name}
					</option>
				))}
			</select>
			<button
				onClick={() => void assignSelectedCamera()}
				disabled={!selectedFileIds.length || !bulkSiteId}
				style={{ ...primaryButtonStyle, opacity: selectedFileIds.length && bulkSiteId ? 1 : 0.55 }}
			>
				Apply to selected
			</button>
		</div>
	);

	const renderGroupedGrid = (gridFiles: MediaFile[]) => {
		const days = groupFilesByDate(gridFiles);
		if (!days.length) return null;
		return (
			<div style={{ display: "grid", gap: spacing.xxl }}>
				{days.map((day) => (
					<section key={day.key} id={`media-day-${day.key}`} style={{ display: "grid", gap: spacing.lg }}>
						<div>
							<div style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold }}>
								{day.label}
							</div>
							<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: 2 }}>
								{day.files.length} file{day.files.length === 1 ? "" : "s"}
							</div>
						</div>
						{renderGrid(day.files, gridFiles)}
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
					<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted, minWidth: 72, textAlign: "right" }}>
						{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
					</div>
					{view === "review" ? (
						<button onClick={() => void undoLastReviewAction()} style={buttonStyle}>
							Undo<span style={shortcutHintStyle}>Z</span>
						</button>
					) : null}
					{view === "review" ? (
						<button onClick={leaveReview} style={buttonStyle}>
							Back{reviewReturnView === "deer" ? " to known deer" : " to cameras"}
							<span style={shortcutHintStyle}>Esc</span>
						</button>
					) : null}
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
				{view !== "review" && duplicateReport.length ? (
					<div style={{ padding: `${spacing.md} ${spacing.xxl}` }}>
						<DuplicateWarningList items={duplicateReport} onOpen={openDuplicateCopy} />
					</div>
				) : null}

				<main style={{ flex: 1, overflow: "auto", padding: spacing.xxl }}>
					{loading ? <div>Loading media…</div> : null}

					{!loading && view === "cameras" ? (
						<div style={{ display: "grid", gap: spacing.xxl }}>
							<div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
								{crumbButton("Camera sites", cameraBrowse.level === "home" ? undefined : () => setCameraBrowse({ level: "home" }), cameraBrowse.level === "home")}
								{cameraBrowse.level === "needs-review" || cameraBrowse.level === "needs-review-site" || cameraBrowse.level === "needs-review-reason" ? (
									<>
										<span style={{ color: colors.textMuted }}>/</span>
										{crumbButton(
											"Needs review",
											cameraBrowse.level === "needs-review" ? undefined : () => setCameraBrowse({ level: "needs-review" }),
											cameraBrowse.level === "needs-review"
										)}
									</>
								) : null}
								{cameraBrowse.level === "needs-review-reason" ? (
									<>
										<span style={{ color: colors.textMuted }}>/</span>
										{crumbButton(
											cameraBrowse.reason === "camera" ? "Need camera site" : "Need animal / buck ID",
											undefined,
											true
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
										subtitle="Still missing a camera site or an animal / buck ID"
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
									<div style={{ display: "grid", gap: spacing.xxl }}>
										<div style={folderGridStyle}>
											<FolderCard
												title="Need camera site"
												subtitle="Assign where these were taken"
												meta={`${filesNeedingCamera.length} file${filesNeedingCamera.length === 1 ? "" : "s"}`}
												accent="review"
												onClick={() => setCameraBrowse({ level: "needs-review-reason", reason: "camera" })}
											/>
											<FolderCard
												title="Need animal / buck ID"
												subtitle="Classify the animal, or tag a known buck. Scrub buck is for small unnamed bucks."
												meta={`${filesNeedingIdentity.length} file${filesNeedingIdentity.length === 1 ? "" : "s"}`}
												accent="review"
												onClick={() => setCameraBrowse({ level: "needs-review-reason", reason: "identity" })}
											/>
										</div>
										<div style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>By camera site</div>
										<div style={folderGridStyle}>
											{pendingSiteIds.map((siteId) =>
												renderLocationFolder(siteId, pendingBySiteId.get(siteId) || [], () =>
													setCameraBrowse({ level: "needs-review-site", siteId })
												)
											)}
										</div>
									</div>
								) : (
									<div style={{ color: colors.textMuted }}>Everything is reviewed.</div>
								)
							) : null}

							{showingFileBrowser ? (
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
											<button onClick={() => void handleUploadFiles()} style={buttonStyle}>
												Upload files
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
									{cameraBrowse.level === "site" && browsingUnassigned ? (
										<div style={{ display: "flex", gap: spacing.md, alignItems: "center", flexWrap: "wrap" }}>
											<button onClick={() => void handleUploadFiles()} style={primaryButtonStyle}>
												Upload files
											</button>
											{visibleSiteFiles.some(fileNeedsReview) ? (
												<button
													onClick={() => startReview(visibleSiteFiles.filter(fileNeedsReview))}
													style={buttonStyle}
												>
													Review pending
												</button>
											) : null}
											<span style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
												Select files to assign a camera site in bulk, or upload more here.
											</span>
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
									{cameraBrowse.level === "needs-review-reason" ? (
										<div style={{ display: "flex", gap: spacing.md, alignItems: "center", flexWrap: "wrap" }}>
											{visibleSiteFiles.length ? (
												<button
													onClick={() => startReview(visibleSiteFiles)}
													style={primaryButtonStyle}
												>
													Review {visibleSiteFiles.length} file{visibleSiteFiles.length === 1 ? "" : "s"}
												</button>
											) : null}
											<span style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
												{cameraBrowse.reason === "camera"
													? "Select files and assign a camera site, or review them one at a time."
													: "Classify the animal, tag a known buck, or mark small unnamed bucks as Scrub buck."}
											</span>
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
									<div style={{ display: "flex", gap: spacing.xxl, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
										<span>{visibleSiteFiles.length} media file{visibleSiteFiles.length === 1 ? "" : "s"}</span>
										<span>{visibleSiteFiles.filter(fileNeedsReview).length} need review</span>
										{selectedSite ? (
											<span>
												{importSessions.filter((session) => session.cameraSiteId === selectedSite.id).length} import session
												{importSessions.filter((session) => session.cameraSiteId === selectedSite.id).length === 1 ? "" : "s"}
											</span>
										) : cameraBrowse.level === "needs-review-reason" ? (
											<span>
												{cameraBrowse.reason === "camera"
													? `${visibleSiteFiles.filter(fileNeedsIdentity).length} also need an animal / buck ID`
													: `${visibleSiteFiles.filter(fileNeedsCamera).length} also need a camera site`}
											</span>
										) : (
											<span>Select files to assign a camera site, or open one to review.</span>
										)}
									</div>

									{visibleSiteFiles.length ? renderBulkCameraBar(visibleSiteFiles) : null}

									{visibleSiteFiles.length ? (
										renderGroupedGrid(visibleSiteFiles)
									) : (
										<div style={{ color: colors.textMuted }}>
											{cameraBrowse.level === "needs-review-site"
												? "Nothing left to review for this location."
												: cameraBrowse.level === "needs-review-reason"
												? cameraBrowse.reason === "camera"
													? "Every file has a camera site."
													: "Every file has an animal / buck ID."
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
									</div>
									{knownDeer.length ? (
										<div style={folderGridStyle}>
											{knownDeer.map((deer) => {
												const deerFiles = sortByDate(activeFiles.filter((file) => file.knownDeerIds?.includes(deer.id)));
												const cover = deerFiles[0];
												const dayCount = groupFilesByDate(deerFiles).length;
												return (
													<FolderCard
														key={deer.id}
														title={deer.name}
														meta={[
															`${dayCount} day${dayCount === 1 ? "" : "s"}`,
															`${deerFiles.length} file${deerFiles.length === 1 ? "" : "s"}`,
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
									{(() => {
										const deerDays = groupFilesByDate(selectedDeerFiles);
										return (
											<>
												<div style={{ marginBottom: spacing.lg, color: colors.textMuted, fontSize: typography.fontSize.sm }}>
													Seen on {deerDays.length} day{deerDays.length === 1 ? "" : "s"} · {selectedDeerFiles.length} file
													{selectedDeerFiles.length === 1 ? "" : "s"} across camera sites
												</div>
												{deerDays.length ? (
													<div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.xl }}>
														{deerDays.map((day) => (
															<button
																key={day.key}
																type="button"
																onClick={() =>
																	document.getElementById(`media-day-${day.key}`)?.scrollIntoView({
																		behavior: "smooth",
																		block: "start"
																	})
																}
																style={buttonStyle}
															>
																{day.label}
																<span style={{ marginLeft: 6, color: colors.textMuted }}>
																	{day.files.length}
																</span>
															</button>
														))}
													</div>
												) : null}
												{selectedDeerFiles.length ? renderGroupedGrid(selectedDeerFiles) : <div>No media tagged to this deer yet.</div>}
											</>
										);
									})()}
								</section>
							)}
						</div>
					) : null}

					{!loading && view === "trash" ? (
						<div style={{ display: "grid", gap: spacing.lg }}>
							<div style={{ color: colors.textMuted, fontSize: typography.fontSize.sm }}>
								Blank and misfire files are hidden from normal views but kept safely on disk. Restore keeps their camera and review metadata. Restoring does not put a deleted original back on the SD card.
							</div>
							{trashedFiles.map((file) => {
								const keptCopy = file.duplicateOfId
									? files.find((item) => item.id === file.duplicateOfId && !item.trashedAt)
									: undefined;
								return (
								<div key={file.id} style={{ display: "flex", alignItems: "center", gap: spacing.lg, padding: spacing.md, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg }}>
									<div style={{ width: 100, height: 70, overflow: "hidden", borderRadius: borderRadius.md }}><MediaPreview file={file} /></div>
									<div style={{ flex: 1 }}>
										<div style={{ fontWeight: typography.fontWeight.semibold }}>{file.name}</div>
										<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
											{file.duplicateOfId ? "Extra copy · " : ""}
											{file.classification ? classificationLabels[file.classification] : "Unclassified"}
											{" · "}
											{siteNames.get(file.cameraSiteId || "") || "Unknown camera"}
											{" · "}
											{formatCaptureDateTime(file.capturedAt || file.trashedAt)}
										</div>
									</div>
									{keptCopy ? (
										<span style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>Kept copy is in the library</span>
									) : (
										<button onClick={() => void restoreFile(file)} style={buttonStyle}>Restore</button>
									)}
								</div>
								);
							})}
							{!trashedFiles.length ? <div>Trash is empty.</div> : null}
						</div>
					) : null}

					{view === "review" ? (
						<div style={{ height: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 0.7fr)", gap: spacing.xxl }}>
							<section style={{ position: "relative", minHeight: 420, background: "#111", borderRadius: borderRadius.lg, overflow: "hidden" }}>
								{currentReviewFile ? <MediaPreview key={currentReviewFile.id} file={currentReviewFile} large /> : (
									<div style={{ height: "100%", display: "grid", placeItems: "center", color: "#fff" }}>Review complete</div>
								)}
								<ReviewHotkeyLegend finished={!currentReviewFile} onPhoto />
							</section>
							<aside style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
								<div>
									<div style={{ display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
										<button
											onClick={() => stepReview(-1)}
											disabled={reviewIndex <= 0}
											style={{ ...buttonStyle, opacity: reviewIndex <= 0 ? 0.45 : 1 }}
										>
											Previous<span style={shortcutHintStyle}>←</span>
										</button>
										<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
											{Math.min(reviewIndex + 1, reviewFiles.length)} of {reviewFiles.length}
										</div>
										<button
											onClick={() => stepReview(1)}
											disabled={reviewIndex >= reviewFiles.length}
											style={{ ...buttonStyle, opacity: reviewIndex >= reviewFiles.length ? 0.45 : 1 }}
										>
											Next<span style={shortcutHintStyle}>→</span>
										</button>
									</div>
									<div style={{ fontWeight: typography.fontWeight.semibold, marginTop: spacing.xs }}>
										{currentReviewFile?.name || "All files reviewed"}
									</div>
									{currentReviewFile ? (
										<div style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
											{formatCaptureDateTime(currentReviewFile.capturedAt || currentReviewFile.createdAt)}
										</div>
									) : null}
									{currentReviewFile && formatReviewNeeds(currentReviewFile) ? (
										<div style={{ marginTop: spacing.sm, fontSize: typography.fontSize.sm, color: colors.primary, fontWeight: typography.fontWeight.semibold }}>
											Still needs {formatReviewNeeds(currentReviewFile)}
										</div>
									) : null}
								</div>

								{currentFileDuplicates.length ? (
									<DuplicateWarningList
										compact
										items={currentFileDuplicates}
										title="Extra copy already in TrueMap"
										onOpen={openDuplicateCopy}
									/>
								) : null}
								{duplicateReport.length ? (
									<DuplicateWarningList
										compact
										items={duplicateReport}
										title={`${duplicateReport.length} extra cop${duplicateReport.length === 1 ? "y" : "ies"} from this import were skipped`}
										onOpen={openDuplicateCopy}
									/>
								) : null}

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
											<button onClick={() => void classifyCurrent("scrub_buck")} style={buttonStyle}>
												Scrub buck<span style={shortcutHintStyle}>6</span>
											</button>
											<button onClick={() => void classifyCurrent("doe")} style={buttonStyle}>
												Doe<span style={shortcutHintStyle}>2</span>
											</button>
											<button onClick={() => void classifyCurrent("other_animal")} style={buttonStyle}>
												Other animal<span style={shortcutHintStyle}>4</span>
											</button>
											<button onClick={() => void classifyCurrent("blank")} style={{ ...buttonStyle, color: colors.error, gridColumn: "1 / -1" }}>
												Blank / misfire<span style={shortcutHintStyle}>1</span>
											</button>
											<div style={{ gridColumn: "1 / -1", fontSize: typography.fontSize.xs, color: colors.textMuted }}>
												{currentReviewFile.sourceDeletedAt
													? "SD card original already deleted for this file."
													: currentReviewFile.sourcePath || currentReviewFile.sourceRelativePath
													? "Blank / misfire also deletes the original on the SD card if the card is still connected."
													: "No SD card original is recorded for this file."}
											</div>
										</div>
										<ReviewHotkeyLegend finished={false} />
									</>
								) : (
									<>
										<button onClick={() => void finishReview()} style={primaryButtonStyle}>
											Finish review and move blanks to Trash<span style={shortcutHintStyle}>Enter</span>
										</button>
										<ReviewHotkeyLegend finished />
									</>
								)}
								<button onClick={leaveReview} style={{ ...buttonStyle, marginTop: "auto" }}>
									Back{reviewReturnView === "deer" ? " to known deer" : " to cameras"}
									<span style={shortcutHintStyle}>Esc</span>
								</button>
							</aside>
						</div>
					) : null}
				</main>
			</div>
		</div>
	);
}
