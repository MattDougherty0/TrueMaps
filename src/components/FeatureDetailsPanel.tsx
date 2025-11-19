import { useMemo, useState } from "react";
import { useSelectionStore } from "../state/selection";
import { layerConfigById } from "../lib/geo/layerConfig";
import type { LayerId } from "../lib/geo/schema";
import FeatureForm from "./FeatureForm";
import { useMapInstance } from "../state/map";
import { toLonLat } from "ol/proj";

export default function FeatureDetailsPanel() {
	const selected = useSelectionStore((s) => s.selected);
	const map = useMapInstance();
	const [editing, setEditing] = useState(false);
	const [quickNote, setQuickNote] = useState("");

	// Derive stable deps so hooks count/order never changes between renders
	const layerId = (selected?.layerId as LayerId | undefined) || undefined;
	const feature = (selected?.feature as any) || null;
	const cfg = useMemo(() => (layerId ? layerConfigById[layerId] : null), [layerId]);
	const props = feature?.getProperties?.() || {};
	const featureName = typeof props.name === "string" && props.name.trim().length > 0 ? props.name.trim() : null;

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


