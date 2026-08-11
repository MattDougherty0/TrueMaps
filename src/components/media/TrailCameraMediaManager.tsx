import { useEffect, useMemo, useState, type CSSProperties } from "react";
import useAppStore from "../../state/store";
import {
	useMediaStore,
	type KnownDeer,
	type MediaClassification,
	type MediaFile
} from "../../state/media";
import { loadCameraSites, updateCameraSiteArea, type CameraSite } from "../../lib/media/cameraSites";
import { borderRadius, colors, spacing, typography } from "../../lib/theme";

type ManagerView = "cameras" | "deer" | "trash" | "review";

type TrailCameraMediaManagerProps = {
	onClose: () => void;
	onOpenContent: () => void;
	initialCameraName?: string | null;
	initialCameraSiteId?: string | null;
};

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
				<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
					{cameraName || "Unassigned camera"}
					{file.capturedAt ? ` · ${new Date(file.capturedAt).toLocaleDateString()}` : ""}
				</div>
				<div style={{ fontSize: typography.fontSize.xs, color: file.classification === "blank" ? colors.error : colors.textSecondary }}>
					{file.classification ? classificationLabels[file.classification] : "Needs review"}
					{deerNames.length ? ` · ${deerNames.join(", ")}` : ""}
				</div>
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
		loadFromProject,
		saveToProject
	} = useMediaStore();
	const [sites, setSites] = useState<CameraSite[]>([]);
	const [selectedSiteId, setSelectedSiteId] = useState("");
	const [selectedDeerId, setSelectedDeerId] = useState("");
	const [newDeerName, setNewDeerName] = useState("");
	const [existingFolderId, setExistingFolderId] = useState("");
	const [view, setView] = useState<ManagerView>("cameras");
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
				setSites(loadedSites);
				const initial =
					loadedSites.find((site) => site.id === initialCameraSiteId) ||
					loadedSites.find((site) => site.name === initialCameraName) ||
					loadedSites[0];
				setSelectedSiteId(initial?.id || "__unassigned__");
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

	const selectedSite = sites.find((site) => site.id === selectedSiteId) || null;
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

	const activeFiles = useMemo(
		() => files.filter((file) => !file.trashedAt),
		[files]
	);
	const selectedSiteFiles = useMemo(
		() =>
			activeFiles
				.filter((file) =>
					selectedSiteId === "__unassigned__"
						? !file.cameraSiteId
						: file.cameraSiteId === selectedSiteId
				)
				.sort((a, b) => (b.capturedAt || b.createdAt).localeCompare(a.capturedAt || a.createdAt)),
		[activeFiles, selectedSiteId]
	);
	const selectedDeerFiles = useMemo(
		() =>
			activeFiles
				.filter((file) => file.knownDeerIds?.includes(selectedDeerId))
				.sort((a, b) => (b.capturedAt || b.createdAt).localeCompare(a.capturedAt || a.createdAt)),
		[activeFiles, selectedDeerId]
	);
	const trashedFiles = useMemo(
		() => files.filter((file) => file.trashedAt).sort((a, b) => String(b.trashedAt).localeCompare(String(a.trashedAt))),
		[files]
	);
	const reviewFiles = reviewIds.map((id) => files.find((file) => file.id === id)).filter(Boolean) as MediaFile[];
	const currentReviewFile = reviewFiles[reviewIndex] || null;

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
		setExistingFolderId("");
		await saveToProject(projectPath);
		setMessage(`Created ${folder.name} and linked ${matchingFiles.length} existing file(s) without moving them.`);
	};

	const startReview = (siteFiles: MediaFile[], startId?: string) => {
		const ids = siteFiles.map((file) => file.id);
		setReviewIds(ids);
		setReviewIndex(Math.max(0, startId ? ids.indexOf(startId) : 0));
		setView("review");
	};

	const saveCameraArea = async (nextAreaName: string) => {
		if (!projectPath || !selectedSite || !nextAreaName.trim()) return;
		await updateCameraSiteArea(
			projectPath,
			selectedSite.propertyId,
			selectedSite.id,
			nextAreaName.trim()
		);
		setSites((current) =>
			current.map((site) =>
				site.id === selectedSite.id ? { ...site, areaName: nextAreaName.trim() } : site
			)
		);
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

	const classifyCurrent = async (classification: MediaClassification) => {
		if (!projectPath || !currentReviewFile) return;
		if (
			classification === "known_buck" &&
			!selectedDeerId &&
			!(currentReviewFile.knownDeerIds || []).length
		) {
			setMessage("Choose or create a known deer first.");
			return;
		}
		updateFile(currentReviewFile.id, {
			classification,
			reviewStatus: "reviewed",
			knownDeerIds:
				classification === "known_buck"
					? Array.from(
							new Set([
								...(currentReviewFile.knownDeerIds || []),
								...(selectedDeerId ? [selectedDeerId] : [])
							])
					  )
					: []
		});
		await saveToProject(projectPath);
		setMessage("");
		setReviewIndex((index) => index + 1);
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
		setMessage(
			`Review complete. ${changes.length} blank/misfire file(s) moved to recoverable Trash.`
		);
		setView("cameras");
		setReviewIds([]);
		setReviewIndex(0);
	};

	const restoreFile = async (file: MediaFile) => {
		if (!projectPath) return;
		updateFile(file.id, { trashedAt: undefined });
		await saveToProject(projectPath);
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

	const renderGrid = (gridFiles: MediaFile[]) => (
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
					onClick={() => startReview(gridFiles, file.id)}
				/>
			))}
		</div>
	);

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
							Import an SD card, review the useful moments, and track known deer across camera sites.
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
						] as Array<[ManagerView, string]>).map(([id, label]) => (
							<button
								key={id}
								onClick={() => setView(id)}
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
							<div style={{ display: "flex", gap: spacing.md, alignItems: "end", flexWrap: "wrap" }}>
								<label style={{ display: "grid", gap: spacing.xs, minWidth: 260 }}>
									<span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Camera site</span>
									<select value={selectedSiteId} onChange={(event) => setSelectedSiteId(event.target.value)} style={inputStyle}>
										<option value="__unassigned__">Unassigned media</option>
										{sites.map((site) => (
											<option key={site.id} value={site.id}>
												{site.areaName || propertyNames.get(site.propertyId || "") || "Property"} / {site.name}
											</option>
										))}
									</select>
								</label>
								<label style={{ display: "grid", gap: spacing.xs, minWidth: 160 }}>
									<span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>Area</span>
									<input
										list="trail-camera-areas"
										value={areaName}
										onChange={(event) => setAreaName(event.target.value)}
										onBlur={() => areaName.trim() && void saveCameraArea(areaName)}
										placeholder="Camp or Leacock"
										disabled={!selectedSite}
										style={{ ...inputStyle, opacity: selectedSite ? 1 : 0.55 }}
									/>
									<datalist id="trail-camera-areas">
										<option value="Camp" />
										<option value="Leacock" />
									</datalist>
								</label>
								<button
									onClick={() => void handleImport()}
									disabled={!selectedSite || importing}
									style={{ ...primaryButtonStyle, opacity: !selectedSite || importing ? 0.55 : 1 }}
								>
									{importing ? "Importing…" : "Import SD Card Folder"}
								</button>
								{selectedSiteFiles.some((file) => file.reviewStatus === "pending") ? (
									<button
										onClick={() => startReview(selectedSiteFiles.filter((file) => file.reviewStatus === "pending"))}
										style={buttonStyle}
									>
										Review pending
									</button>
								) : null}
							</div>
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
							{folders.length && selectedSite ? (
								<div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap" }}>
									<select value={existingFolderId} onChange={(event) => setExistingFolderId(event.target.value)} style={{ ...inputStyle, minWidth: 240 }}>
										<option value="">Choose an existing My Content folder…</option>
										{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}
									</select>
									<button
										onClick={() => void linkExistingFolderToSite()}
										disabled={!selectedSite || !existingFolderId}
										style={{ ...buttonStyle, opacity: selectedSite && existingFolderId ? 1 : 0.55 }}
									>
										Link folder to this site
									</button>
									<span style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>Links existing files in place; nothing is copied.</span>
								</div>
							) : null}

							{!sites.length ? (
								<div style={{ padding: spacing.xxl, border: `1px dashed ${colors.borderStrong}`, borderRadius: borderRadius.lg }}>
									Add or import a Trail Camera point on the map first, then return here to import its SD card.
								</div>
							) : (
								<div style={{ display: "flex", gap: spacing.xxl, color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
									<span>{selectedSiteFiles.length} media file(s)</span>
									<span>{selectedSiteFiles.filter((file) => file.reviewStatus === "pending").length} need review</span>
									{selectedSite ? <span>{importSessions.filter((session) => session.cameraSiteId === selectedSiteId).length} import session(s)</span> : <span>Assign these files by opening them below.</span>}
								</div>
							)}

							{selectedSiteFiles.length ? renderGrid(selectedSiteFiles) : sites.length ? (
								<div style={{ color: colors.textMuted }}>{selectedSite ? "No media imported for this camera site yet." : "No unassigned media."}</div>
							) : null}
						</div>
					) : null}

					{!loading && view === "deer" ? (
						<div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: spacing.xxl, height: "100%" }}>
							<aside style={{ borderRight: `1px solid ${colors.border}`, paddingRight: spacing.xl }}>
								<div style={{ fontWeight: typography.fontWeight.semibold, marginBottom: spacing.md }}>Known deer</div>
								<div style={{ display: "grid", gap: spacing.sm }}>
									{knownDeer.map((deer) => (
										<button
											key={deer.id}
											onClick={() => setSelectedDeerId(deer.id)}
											style={{
												...buttonStyle,
												textAlign: "left",
												background: selectedDeerId === deer.id ? colors.primaryLight : colors.bgButton
											}}
										>
											{deer.name}
										</button>
									))}
								</div>
								<div style={{ marginTop: spacing.xl, display: "grid", gap: spacing.sm }}>
									<input
										value={newDeerName}
										onChange={(event) => setNewDeerName(event.target.value)}
										placeholder="New deer name"
										style={inputStyle}
									/>
									<button onClick={() => void createKnownDeer()} disabled={!newDeerName.trim()} style={buttonStyle}>Add known deer</button>
								</div>
								{folders.length ? (
									<div style={{ marginTop: spacing.xl, paddingTop: spacing.lg, borderTop: `1px solid ${colors.border}`, display: "grid", gap: spacing.sm }}>
										<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>Use an existing deer folder</div>
										<select value={existingFolderId} onChange={(event) => setExistingFolderId(event.target.value)} style={inputStyle}>
											<option value="">Choose folder…</option>
											{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.path}</option>)}
										</select>
										<button onClick={() => void createDeerFromFolder()} disabled={!existingFolderId} style={buttonStyle}>Create deer from folder</button>
									</div>
								) : null}
							</aside>
							<section>
								{selectedDeerId ? (
									<>
										<h3 style={{ marginTop: 0 }}>{deerNames.get(selectedDeerId)}</h3>
										<div style={{ marginBottom: spacing.xl, color: colors.textMuted, fontSize: typography.fontSize.sm }}>
											{selectedDeerFiles.length} appearance(s) across camera sites
										</div>
										{selectedDeerFiles.length ? renderGrid(selectedDeerFiles) : <div>No media tagged to this deer yet.</div>}
									</>
								) : (
									<div style={{ color: colors.textMuted }}>Choose a known deer or add one to start its timeline.</div>
								)}
							</section>
						</div>
					) : null}

					{!loading && view === "trash" ? (
						<div style={{ display: "grid", gap: spacing.lg }}>
							<div style={{ color: colors.textMuted, fontSize: typography.fontSize.sm }}>
								Blank and misfire files are hidden from normal views but kept safely on disk. Restore keeps their camera and review metadata.
							</div>
							{trashedFiles.map((file) => (
								<div key={file.id} style={{ display: "flex", alignItems: "center", gap: spacing.lg, padding: spacing.md, border: `1px solid ${colors.border}`, borderRadius: borderRadius.lg }}>
									<div style={{ width: 100, height: 70, overflow: "hidden", borderRadius: borderRadius.md }}><MediaPreview file={file} /></div>
									<div style={{ flex: 1 }}>
										<div style={{ fontWeight: typography.fontWeight.semibold }}>{file.name}</div>
										<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>{siteNames.get(file.cameraSiteId || "") || "Unknown camera"}</div>
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
									{currentReviewFile?.capturedAt ? (
										<div style={{ fontSize: typography.fontSize.sm, color: colors.textMuted }}>
											{new Date(currentReviewFile.capturedAt).toLocaleString()}
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
												Keep known buck & next
											</button>
										</div>
										<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.sm }}>
											<button onClick={() => void classifyCurrent("unknown_buck")} style={buttonStyle}>Unknown buck</button>
											<button onClick={() => void classifyCurrent("doe")} style={buttonStyle}>Doe</button>
											<button onClick={() => void classifyCurrent("other_animal")} style={buttonStyle}>Other animal</button>
											<button onClick={() => void classifyCurrent("blank")} style={{ ...buttonStyle, color: colors.error }}>Blank / misfire</button>
										</div>
									</>
								) : (
									<button onClick={() => void finishReview()} style={primaryButtonStyle}>Finish review and move blanks to Trash</button>
								)}
								<button onClick={() => setView("cameras")} style={{ ...buttonStyle, marginTop: "auto" }}>Exit review</button>
							</aside>
						</div>
					) : null}
				</main>
			</div>
		</div>
	);
}
