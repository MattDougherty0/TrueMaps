import { useEffect, useMemo, useState } from "react";
import { useSelectionStore } from "../state/selection";
import { layerConfigById } from "../lib/geo/layerConfig";
import type { LayerId } from "../lib/geo/schema";
import FeatureForm from "./FeatureForm";
import { useMapInstance } from "../state/map";
import { toLonLat } from "ol/proj";
import useAppStore from "../state/store";

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

	return (
		<div
			style={{
				position: "fixed",
				left: 12,
				bottom: 12,
				padding: 12,
				borderRadius: 8,
				border: "1px solid rgba(0,0,0,0.12)",
				background: "rgba(255,255,255,0.96)",
				boxShadow: "0 16px 32px rgba(15,23,42,0.18)",
				zIndex: 1800,
				minWidth: 320,
				maxWidth: 560
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
				<div style={{ display: "flex", flexDirection: "column" }}>
					<span style={{ fontWeight: 600, fontSize: 14 }}>
						{cfg.icon ? `${cfg.icon} ` : ""}
						{featureName || cfg.label}
					</span>
					{featureName ? (
						<span style={{ fontSize: 11, color: "rgba(15,23,42,0.6)" }}>{cfg.label}</span>
					) : null}
				</div>
				<div style={{ display: "flex", gap: 6 }}>
					<button onClick={onToggleGeom} style={{ fontSize: 12, padding: "4px 8px" }}>
						{geomEdit ? "Stop Edit" : "Edit geometry"}
					</button>
					<button onClick={onZoomTo} style={{ fontSize: 12, padding: "4px 8px" }}>
						Zoom to
					</button>
					{canDelete ? (
						<button
							onClick={onDelete}
							style={{ fontSize: 12, padding: "4px 8px", color: "#c62828", borderColor: "rgba(198,40,40,0.3)" }}
						>
							Delete
						</button>
					) : null}
					<button onClick={() => setEditing((s) => !s)} style={{ fontSize: 12, padding: "4px 8px" }}>
						{editing ? "Close Edit" : "Edit"}
					</button>
				</div>
			</div>
			{editing ? (
				<div style={{ marginTop: 8 }}>
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
					<div style={{ fontSize: 12, color: "rgba(0,0,0,0.7)", display: "flex", flexDirection: "column", gap: 4 }}>
						{Object.entries(props)
							.filter(([k]) => !["geometry", "name", "imported_by", "imported_at", "created_by", "created_at"].includes(k))
							.slice(0, 10)
							.map(([k, v]) => (
								<div key={k}>
									<strong>{k}</strong>: {Array.isArray(v) ? v.join(", ") : String(v)}
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
								<div key={row.label}>
									<strong>{row.label}</strong>: {row.value}
								</div>
							));
						})()}
					</div>
					{layerId === "trail_cameras" ? (
						<div style={{ marginTop: 10, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
							<div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Camera Media</div>
							<div style={{ fontSize: 12, color: "rgba(0,0,0,0.65)", marginBottom: 8 }}>
								Folder: <code>{mediaFolder || "— (not linked yet)"}</code>
							</div>
							<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
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
									style={{ fontSize: 12, padding: "6px 10px", cursor: "pointer" }}
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
										style={{ fontSize: 12, padding: "6px 10px", cursor: "pointer" }}
									>
										Open folder
									</button>
								) : null}
							</div>
							{cameraFiles ? (
								cameraFiles.length ? (
									<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
										{cameraFiles.slice(0, 36).map((rel) => (
											<div
												key={rel}
												style={{
													width: 96,
													height: 72,
													borderRadius: 6,
													overflow: "hidden",
													border: "1px solid rgba(0,0,0,0.1)",
													background: "#f3f3f3",
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
													<div style={{ fontSize: 10, padding: 6 }}>{rel.split("/").pop()}</div>
												)}
											</div>
										))}
									</div>
								) : (
									<div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>No media found in this folder.</div>
								)
							) : (
								<div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>Link a folder to see images here.</div>
							)}
						</div>
					) : null}
					<div style={{ display: "flex", gap: 6, marginTop: 8 }}>
						<input
							type="text"
							value={quickNote}
							onChange={(e) => setQuickNote(e.target.value)}
							placeholder="Quick note…"
							style={{ flex: 1, fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd" }}
							onKeyDown={(e) => {
								if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSaveQuickNote();
							}}
						/>
						<button onClick={onSaveQuickNote} style={{ fontSize: 12, padding: "6px 10px" }}>
							Save
						</button>
					</div>
				</>
			)}
		</div>
	);
}


