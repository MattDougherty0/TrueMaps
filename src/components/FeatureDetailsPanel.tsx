import { useEffect, useMemo, useState } from "react";
import { useSelectionStore } from "../state/selection";
import { layerConfigById } from "../lib/geo/layerConfig";
import type { LayerId } from "../lib/geo/schema";
import FeatureForm from "./FeatureForm";
import { useMapInstance } from "../state/map";
import { toLonLat } from "ol/proj";
import useAppStore from "../state/store";
import { borderRadius, colors, spacing, typography } from "../lib/theme";

export default function FeatureDetailsPanel() {
	const selected = useSelectionStore((s) => s.selected);
	const map = useMapInstance();
	const { projectPath } = useAppStore();
	const [editing, setEditing] = useState(false);
	const [quickNote, setQuickNote] = useState("");
	const [cameraFiles, setCameraFiles] = useState<string[] | null>(null);
	const [cameraPreviews, setCameraPreviews] = useState<Record<string, string>>({});

	// Derive stable deps so hooks count/order never changes between renders
	const layerId = (selected?.layerId as LayerId | undefined) || undefined;
	const feature = (selected?.feature as any) || null;
	const cfg = useMemo(() => (layerId ? layerConfigById[layerId] : null), [layerId]);
	const props = feature?.getProperties?.() || {};
	const featureName = typeof props.name === "string" && props.name.trim().length > 0 ? props.name.trim() : null;
	const mediaFolder = typeof props.media_folder === "string" ? props.media_folder.trim() : "";

	const canUseGenericPersist = true; // for layers managed by GenericLayer
	const canDelete =
		layerId === "trails" ||
		(!!layerId && layerId in layerConfigById); // delete for generic layers via their own delete handler
	const [geomEdit, setGeomEdit] = useState(false);

	const onZoomTo = () => {
		try {
			const geom = feature.getGeometry?.();
			if (!geom || !map) return;
			const extent = geom.getExtent?.();
			if (extent && extent.every((v: unknown) => typeof v === "number")) {
				// center of extent
				const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
				const [lon, lat] = toLonLat(center);
				window.dispatchEvent(new CustomEvent("map:jump-to", { detail: { lon, lat, zoom: 17 } }));
			}
		} catch {
			// ignore
		}
	};

	const onDelete = () => {
		if (!layerId) return;
		if (layerId === "trails") {
			window.dispatchEvent(new Event("delete-selected-trail"));
			useSelectionStore.getState().setSelected(null);
			return;
		}
		window.dispatchEvent(new Event(`delete-feature-${layerId}`));
		useSelectionStore.getState().setSelected(null);
	};
	// Toggle modify interactions
	const onToggleGeom = () => {
		const next = !geomEdit;
		setGeomEdit(next);
		const evt = next ? `layer:enable-modify:${layerId}` : `layer:disable-modify:${layerId}`;
		window.dispatchEvent(new Event(evt));
	};

	// Ensure modify is disabled when selection changes or panel unmounts
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useMemo(() => {
		setGeomEdit(false);
		if (layerId) {
			window.dispatchEvent(new Event(`layer:disable-modify:${layerId}`));
		}
		return null;
	}, [layerId, feature]);


	const onSaveQuickNote = () => {
		const text = String(quickNote || "").trim();
		if (!text) return;
		const now = new Date();
		const yyyy = now.getFullYear();
		const mm = String(now.getMonth() + 1).padStart(2, "0");
		const dd = String(now.getDate()).padStart(2, "0");
		const hh = String(now.getHours()).padStart(2, "0");
		const min = String(now.getMinutes()).padStart(2, "0");
		const stamp = `[${yyyy}-${mm}-${dd} ${hh}:${min}] `;
		const current = feature.get("notes");
		const next = (current ? String(current) + "\n" : "") + stamp + text;
		feature.set("notes", next);
		setQuickNote("");
		if (canUseGenericPersist) {
			window.dispatchEvent(new Event(`layer:persist:${layerId}`));
		}
	};

	const editInitial = useMemo(() => {
		const copy = { ...props };
		delete (copy as any).geometry;
		return copy;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [feature]);

	// Trail camera media: list + preview
	useEffect(() => {
		let cancelled = false;
		const isCamera = layerId === "trail_cameras";
		if (!isCamera || !projectPath || !mediaFolder || typeof window.api.listMediaFolder !== "function") {
			setCameraFiles(null);
			setCameraPreviews({});
			return () => {
				cancelled = true;
			};
		}
		(async () => {
			try {
				const files = await window.api.listMediaFolder(projectPath, mediaFolder);
				if (cancelled) return;
				setCameraFiles(files);
				const previews: Record<string, string> = {};
				for (const rel of files) {
					try {
						const abs = await window.api.resolveMediaPath(projectPath, rel);
						previews[rel] = `file://${encodeURI(abs.replace(/\\/g, "/"))}`;
					} catch {
						previews[rel] = "";
					}
				}
				if (!cancelled) setCameraPreviews(previews);
			} catch {
				if (!cancelled) {
					setCameraFiles([]);
					setCameraPreviews({});
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [layerId, projectPath, mediaFolder]);

	if (!selected || !cfg || !layerId) return null;

	const panelStyle: React.CSSProperties = {
		position: "fixed",
		left: 12,
		bottom: 12,
		zIndex: 1800,
		width: "min(560px, calc(100vw - 24px))",
		maxHeight: "min(56vh, 520px)",
		overflow: "auto",
		padding: spacing.xl,
		borderRadius: borderRadius.xl,
		border: `1px solid ${colors.borderMedium}`,
		background: colors.bgPanel,
		boxShadow: colors.shadowXLarge,
		backdropFilter: "blur(10px)"
	};

	const buttonBase: React.CSSProperties = {
		padding: `${spacing.xs} ${spacing.md}`,
		borderRadius: borderRadius.md,
		border: `1px solid ${colors.borderMedium}`,
		background: colors.bgButton,
		color: colors.textPrimary,
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		cursor: "pointer",
		transition: "all 0.15s ease",
		whiteSpace: "nowrap"
	};

	const primaryButton: React.CSSProperties = {
		...buttonBase,
		background: colors.primary,
		borderColor: colors.primary,
		color: colors.textOnPrimary
	};

	const dangerButton: React.CSSProperties = {
		...buttonBase,
		background: "rgba(239, 68, 68, 0.10)",
		borderColor: "rgba(239, 68, 68, 0.25)",
		color: colors.error
	};

	const subtleText: React.CSSProperties = { fontSize: typography.fontSize.xs, color: colors.textMuted };

	return (
		<div style={panelStyle}>
			<div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
				{/* Header row: give the title maximum horizontal room */}
				<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.lg }}>
					<div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sm, minWidth: 0, flex: 1 }}>
						<span style={{ fontSize: 18, flex: "0 0 auto" }}>{cfg.icon ?? "📍"}</span>
						<div style={{ minWidth: 0, flex: 1 }}>
							<div
								style={{
									fontSize: typography.fontSize.lg,
									fontWeight: typography.fontWeight.semibold,
									color: colors.textPrimary,
									lineHeight: typography.lineHeight.tight,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap"
								}}
								title={featureName || cfg.label}
							>
								{featureName || cfg.label}
							</div>
							<div style={subtleText}>{featureName ? cfg.label : "Selected feature"}</div>
						</div>
					</div>
					<button
						onClick={() => useSelectionStore.getState().setSelected(null)}
						style={{ ...buttonBase, background: "transparent" }}
						title="Close"
					>
						Close
					</button>
				</div>

				{/* Actions row: moved below so it doesn't squeeze the title */}
				<div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", justifyContent: "flex-end" }}>
					<button onClick={onZoomTo} style={buttonBase}>
						Zoom to
					</button>
					<button onClick={onToggleGeom} style={buttonBase}>
						{geomEdit ? "Stop geometry edit" : "Edit geometry"}
					</button>
					{canDelete ? (
						<button onClick={onDelete} style={dangerButton}>
							Delete
						</button>
					) : null}
					<button onClick={() => setEditing((s) => !s)} style={buttonBase}>
						{editing ? "Done" : "Edit details"}
					</button>
				</div>
			</div>
			<div style={{ height: 1, background: colors.border, margin: `${spacing.lg} 0` }} />
			{editing ? (
				<div>
					<FeatureForm
						layerId={layerId}
						initialValues={editInitial as any}
						onSubmit={(vals) => {
							feature.setProperties(vals);
							setEditing(false);
							if (canUseGenericPersist) {
								window.dispatchEvent(new Event(`layer:persist:${layerId}`));
							}
						}}
						onCancel={() => setEditing(false)}
					/>
				</div>
			) : (
				<>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "120px 1fr",
							gap: spacing.sm,
							alignItems: "baseline",
							fontSize: typography.fontSize.sm,
							color: colors.textPrimary
						}}
					>
						{Object.entries(props)
							.filter(([k]) => !["geometry", "imported_by", "imported_at", "created_by", "created_at"].includes(k))
							.slice(0, 10)
							.map(([k, v]) => (
								<div key={k} style={{ display: "contents" }}>
									<div style={{ color: colors.textMuted, fontWeight: typography.fontWeight.medium, textTransform: "capitalize" }}>
										{k.replace(/_/g, " ")}
									</div>
									<div style={{ color: colors.textPrimary, wordBreak: "break-word" }}>
										{Array.isArray(v) ? v.join(", ") : String(v)}
									</div>
								</div>
							))}
						{(() => {
							const metaRows: Array<{ label: string; value: string }> = [];
							const importedBy =
								(typeof props.imported_by === "string" && props.imported_by) ||
								(typeof props.created_by === "string" && props.created_by) ||
								"";
							if (importedBy) metaRows.push({ label: "Imported by", value: importedBy });
							const importedAtRaw = (props.imported_at as string) || (props.created_at as string) || "";
							if (importedAtRaw) {
								const d = new Date(importedAtRaw);
								const formatted = Number.isNaN(d.getTime())
									? importedAtRaw
									: d.toLocaleString(undefined, {
											year: "numeric",
											month: "short",
											day: "2-digit",
											hour: "2-digit",
											minute: "2-digit"
									  });
								metaRows.push({ label: "Imported at", value: formatted });
							}
							return metaRows.map((row) => (
								<div key={row.label} style={{ display: "contents" }}>
									<div style={{ color: colors.textMuted, fontWeight: typography.fontWeight.medium }}>{row.label}</div>
									<div style={{ color: colors.textPrimary }}>{row.value}</div>
								</div>
							));
						})()}
					</div>
					{layerId === "trail_cameras" ? (
						<div style={{ marginTop: spacing.xl }}>
							<div style={{ height: 1, background: colors.border, margin: `${spacing.lg} 0` }} />
							<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
								<div style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
									Camera Media
								</div>
								<div style={subtleText}>{cameraFiles ? `${cameraFiles.length} file(s)` : "Not linked"}</div>
							</div>
							<div style={{ marginTop: spacing.sm, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
								Folder:{" "}
								<code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: colors.textPrimary }}>
									{mediaFolder || "—"}
								</code>
							</div>
							<div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.md }}>
								<button
									onClick={async () => {
										if (!projectPath) return;
										if (typeof window.api.importMediaFolder !== "function") {
											window.alert("Media folder import is not available in this build.");
											return;
										}
										const sourceDir = await window.api.chooseDirectory();
										if (!sourceDir) return;
										const baseName = (featureName || "camera").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
										const target = `media/trail_cameras/${baseName || "camera"}`;
										const res = await window.api.importMediaFolder(projectPath, sourceDir, target);
										feature.set("media_folder", res.folder);
										window.dispatchEvent(new Event(`layer:persist:${layerId}`));
									}}
									style={primaryButton}
								>
									Link folder…
								</button>
								{mediaFolder && typeof window.api.openPath === "function" ? (
									<button
										onClick={async () => {
											if (!projectPath) return;
											try {
												const abs = await window.api.resolveMediaPath(projectPath, mediaFolder);
												await window.api.openPath!(abs);
											} catch {
												// ignore
											}
										}}
										style={buttonBase}
									>
										Open folder
									</button>
								) : null}
							</div>
							{cameraFiles ? (
								cameraFiles.length ? (
									<div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
										{cameraFiles.slice(0, 36).map((rel) => (
											<div
												key={rel}
												style={{
													width: 96,
													height: 72,
													borderRadius: borderRadius.md,
													overflow: "hidden",
													border: `1px solid ${colors.border}`,
													background: colors.bgSecondary,
													cursor: cameraPreviews[rel] ? "pointer" : "default"
												}}
												onClick={() => {
													const url = cameraPreviews[rel];
													if (url) window.open(url, "_blank");
												}}
												title={rel}
											>
												{cameraPreviews[rel] ? (
													<img src={cameraPreviews[rel]} alt={rel} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
												) : (
													<div style={{ fontSize: typography.fontSize.xs, padding: spacing.md }}>{rel.split("/").pop()}</div>
												)}
											</div>
										))}
									</div>
								) : (
									<div style={{ marginTop: spacing.md, fontSize: typography.fontSize.sm, color: colors.textMuted }}>
										No media found in this folder.
									</div>
								)
							) : (
								<div style={{ marginTop: spacing.md, fontSize: typography.fontSize.sm, color: colors.textMuted }}>
									Link a folder to see images here.
								</div>
							)}
						</div>
					) : null}
					<div style={{ height: 1, background: colors.border, margin: `${spacing.lg} 0` }} />
					<div style={{ display: "flex", gap: spacing.sm, alignItems: "center" }}>
						<input
							type="text"
							value={quickNote}
							onChange={(e) => setQuickNote(e.target.value)}
							placeholder="Quick note…"
							style={{
								flex: 1,
								fontSize: typography.fontSize.sm,
								padding: `${spacing.sm} ${spacing.md}`,
								borderRadius: borderRadius.md,
								border: `1px solid ${colors.borderMedium}`,
								background: colors.bgPanelSolid,
								color: colors.textPrimary
							}}
							onKeyDown={(e) => {
								if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSaveQuickNote();
							}}
						/>
						<button onClick={onSaveQuickNote} style={primaryButton}>
							Add note
						</button>
					</div>
				</>
			)}
		</div>
	);
}


