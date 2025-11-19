import { useState } from "react";
import type { CSSProperties } from "react";
import { useBasemapStore } from "../../state/basemaps";
import { useHistoricalImagery } from "../../state/historical";

export default function BasemapToggles() {
	const [open, setOpen] = useState(false);
	const visible = useBasemapStore((s) => s.visible);
	const setVisible = useBasemapStore((s) => s.setVisible);
	const histEnabled = useHistoricalImagery((s) => s.enabled);
	const setHistEnabled = useHistoricalImagery((s) => s.setEnabled);
	const entries = useHistoricalImagery((s) => s.entries);
	const selectedId = useHistoricalImagery((s) => s.selectedId);
	const setSelected = useHistoricalImagery((s) => s.setSelected);
	const addEntry = useHistoricalImagery((s) => s.addEntry);
	const toggleButtonStyle: CSSProperties = {
		padding: "6px 12px",
		borderRadius: 6,
		border: "1px solid rgba(15,23,42,0.12)",
		background: "rgba(255,255,255,0.92)",
		fontSize: 12,
		cursor: "pointer",
		color: "rgba(15,23,42,0.75)",
		boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
		width: "100%",
		textAlign: "left"
	};

	if (!open) {
		return (
			<button onClick={() => setOpen(true)} style={toggleButtonStyle}>
				Basemaps
			</button>
		);
	}

	return (
		<div
			style={{
				padding: "12px 14px",
				background: "rgba(255,255,255,0.94)",
				border: "1px solid rgba(15, 23, 42, 0.12)",
				borderRadius: 6,
				boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
				display: "flex",
				flexDirection: "column",
				gap: 4,
				width: "100%"
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<strong style={{ fontSize: 13, color: "rgba(15,23,42,0.75)" }}>Basemaps</strong>
				<button
					onClick={() => setOpen(false)}
					style={{
						border: "none",
						background: "transparent",
						fontSize: 12,
						color: "rgba(15,23,42,0.55)",
						cursor: "pointer"
					}}
				>
					Hide
				</button>
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 6,
					fontSize: 13,
					color: "rgba(15,23,42,0.75)"
				}}
			>
				<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
					<input
						type="checkbox"
						checked={visible.topo}
						onChange={(e) => setVisible("topo", e.target.checked)}
					/>
					Topo
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
					<input
						type="checkbox"
						checked={visible.aerial}
						onChange={(e) => setVisible("aerial", e.target.checked)}
					/>
					Aerial
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
					<input
						type="checkbox"
						checked={visible.hillshade}
						onChange={(e) => setVisible("hillshade", e.target.checked)}
					/>
					Hillshade
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
					<input
						type="checkbox"
						checked={visible.slope}
						onChange={(e) => setVisible("slope", e.target.checked)}
					/>
					Slope
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
					<input
						type="checkbox"
						checked={visible.contours}
						onChange={(e) => setVisible("contours", e.target.checked)}
					/>
					Contours
				</label>
			</div>
			<hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.12)", margin: "8px 0" }} />
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<input type="checkbox" checked={histEnabled} onChange={(e) => setHistEnabled(e.target.checked)} />
				<span style={{ fontWeight: 600, fontSize: 12 }}>Historical Imagery</span>
			</div>
			{histEnabled ? (
				<div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
					<select
						value={selectedId || ""}
						onChange={(e) => setSelected(e.target.value || null)}
						style={{ flex: 1, fontSize: 12, padding: "4px 6px" }}
					>
						<option value="">— Select —</option>
						{entries
							.slice()
							.sort((a, b) => b.year - a.year)
							.map((e) => (
								<option key={e.id} value={e.id}>
									{e.year} — {e.label}
								</option>
							))}
					</select>
					<button
						onClick={() => {
							const yearStr = window.prompt("Year (e.g., 1985):") || "";
							const label = window.prompt("Label (e.g., NHAP 1985 or Wayback 2018-05):") || "";
							const type = (window.prompt("Type: xyz or arcgis-image (default xyz):") || "xyz").trim().toLowerCase();
							const year = Number(yearStr);
							if (!label || !Number.isFinite(year)) return;
							if (type === "arcgis-image") {
								const arcUrl = window.prompt("ArcGIS ImageServer URL (…/ImageServer):") || "";
								const timeParam = window.prompt("TIME (optional, e.g., 1985-01-01,1985-12-31):") || "";
								if (!arcUrl) return;
								addEntry({
									id: `${label.replace(/\s+/g, "_")}_${year}`,
									label,
									year,
									type: "arcgis-image",
									arcgisImageUrl: arcUrl,
									timeParam: timeParam || undefined
								});
							} else {
								const url = window.prompt("XYZ URL template with {z}/{y}/{x}:") || "";
								if (!url) return;
								addEntry({
									id: `${label.replace(/\s+/g, "_")}_${year}`,
									label,
									year,
									type: "xyz",
									urlTemplate: url
								});
							}
						}}
						style={{ fontSize: 12, padding: "4px 8px" }}
					>
						Add
					</button>
				</div>
			) : null}
		</div>
	);
}


