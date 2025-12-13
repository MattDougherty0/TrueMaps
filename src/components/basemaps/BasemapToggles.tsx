import { useState } from "react";
import type { CSSProperties } from "react";
import { useBasemapStore } from "../../state/basemaps";
import { useHistoricalImagery } from "../../state/historical";
import { colors, borderRadius, spacing, typography } from "../../lib/theme";

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
		padding: `${spacing.sm} ${spacing.lg}`,
		borderRadius: borderRadius.md,
		border: `1px solid ${colors.borderMedium}`,
		background: colors.bgButton,
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		cursor: "pointer",
		color: colors.textPrimary,
		boxShadow: colors.shadowSubtle,
		width: "100%",
		textAlign: "left",
		transition: "all 0.2s ease"
	};

	if (!open) {
		return (
			<button 
				onClick={() => setOpen(true)} 
				style={toggleButtonStyle}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = colors.bgButtonHover;
					e.currentTarget.style.boxShadow = colors.shadowMedium;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = colors.bgButton;
					e.currentTarget.style.boxShadow = colors.shadowSubtle;
				}}
			>
				Basemaps
			</button>
		);
	}

	return (
		<div
			style={{
				padding: `${spacing.lg} ${spacing.xl}`,
				background: colors.bgPanel,
				border: `1px solid ${colors.borderMedium}`,
				borderRadius: borderRadius.md,
				boxShadow: colors.shadowLarge,
				display: "flex",
				flexDirection: "column",
				gap: spacing.xs,
				width: "100%"
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<strong style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Basemaps</strong>
				<button
					onClick={() => setOpen(false)}
					style={{
						border: "none",
						background: "transparent",
						fontSize: typography.fontSize.sm,
						color: colors.textMuted,
						cursor: "pointer",
						padding: spacing.xs,
						borderRadius: borderRadius.sm,
						transition: "all 0.2s ease"
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.color = colors.textSecondary;
						e.currentTarget.style.background = colors.bgButton;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.color = colors.textMuted;
						e.currentTarget.style.background = "transparent";
					}}
				>
					Hide
				</button>
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: spacing.sm,
					fontSize: typography.fontSize.base,
					color: colors.textPrimary
				}}
			>
				<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
					<input
						type="checkbox"
						checked={visible.topo}
						onChange={(e) => setVisible("topo", e.target.checked)}
						style={{ accentColor: colors.primary, cursor: "pointer" }}
					/>
					Topo
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
					<input
						type="checkbox"
						checked={visible.aerial}
						onChange={(e) => setVisible("aerial", e.target.checked)}
						style={{ accentColor: colors.primary, cursor: "pointer" }}
					/>
					Aerial
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
					<input
						type="checkbox"
						checked={visible.hillshade}
						onChange={(e) => setVisible("hillshade", e.target.checked)}
						style={{ accentColor: colors.primary, cursor: "pointer" }}
					/>
					Hillshade
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
					<input
						type="checkbox"
						checked={visible.slope}
						onChange={(e) => setVisible("slope", e.target.checked)}
						style={{ accentColor: colors.primary, cursor: "pointer" }}
					/>
					Slope
				</label>
				<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
					<input
						type="checkbox"
						checked={visible.contours}
						onChange={(e) => setVisible("contours", e.target.checked)}
						style={{ accentColor: colors.primary, cursor: "pointer" }}
					/>
					Contours
				</label>
			</div>
			<hr style={{ border: "none", borderTop: `1px solid ${colors.borderMedium}`, margin: `${spacing.md} 0` }} />
			<div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
				<input 
					type="checkbox" 
					checked={histEnabled} 
					onChange={(e) => setHistEnabled(e.target.checked)}
					style={{ accentColor: colors.primary, cursor: "pointer" }}
				/>
				<span style={{ fontWeight: typography.fontWeight.semibold, fontSize: typography.fontSize.sm, color: colors.textPrimary }}>Historical Imagery</span>
			</div>
			{histEnabled ? (
				<div style={{ display: "flex", gap: spacing.sm, alignItems: "center", marginTop: spacing.sm }}>
					<select
						value={selectedId || ""}
						onChange={(e) => setSelected(e.target.value || null)}
						style={{ 
							flex: 1, 
							fontSize: typography.fontSize.sm, 
							padding: `${spacing.xs} ${spacing.sm}`,
							borderRadius: borderRadius.sm,
							border: `1px solid ${colors.border}`,
							background: colors.bgPanelSolid,
							color: colors.textPrimary,
							cursor: "pointer"
						}}
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
						style={{ 
							fontSize: typography.fontSize.sm, 
							padding: `${spacing.xs} ${spacing.md}`,
							borderRadius: borderRadius.sm,
							border: `1px solid ${colors.border}`,
							background: colors.bgButton,
							color: colors.textSecondary,
							cursor: "pointer",
							fontWeight: typography.fontWeight.medium,
							transition: "all 0.2s ease"
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = colors.bgButtonHover;
							e.currentTarget.style.color = colors.textPrimary;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = colors.bgButton;
							e.currentTarget.style.color = colors.textSecondary;
						}}
					>
						Add
					</button>
				</div>
			) : null}
		</div>
	);
}


