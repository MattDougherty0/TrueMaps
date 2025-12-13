import { useState } from "react";
import type { CSSProperties } from "react";
import { useVisibilityStore } from "../state/visibility";
import { useFiltersStore } from "../state/filters";
import type { LayerId } from "../lib/geo/schema";
import { colors, borderRadius, spacing, typography } from "../lib/theme";

export default function LayerPresets() {
	const [open, setOpen] = useState(false);
	const preset = useVisibilityStore((s) => s.preset);
	const setPreset = useVisibilityStore((s) => s.setPreset);
	const timeWindow = useVisibilityStore((s) => s.timeWindow);
	const setTimeWindow = useVisibilityStore((s) => s.setTimeWindow);
	const temporalView = useFiltersStore((s) => s.temporalView);
	const setTemporalView = useFiltersStore((s) => s.setTemporalView);
	const onlyMine = useFiltersStore((s) => s.onlyMine);
	const setOnlyMine = useFiltersStore((s) => s.setOnlyMine);
	const setSpecies = useFiltersStore((s) => s.setSpecies);
	const setLayerOverride = useVisibilityStore((s) => s.setLayerOverride);
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
				Layer Presets
			</button>
		);
	}

	const rowStyle = (active: boolean): CSSProperties => ({
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: `${spacing.sm} ${spacing.lg}`,
		borderRadius: borderRadius.sm,
		border: `1px solid ${active ? colors.primaryBorder : colors.borderMedium}`,
		background: active ? colors.primaryLight : colors.bgSecondary,
		fontSize: typography.fontSize.sm,
		color: active ? colors.primary : colors.textPrimary,
		fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
		cursor: "pointer",
		transition: "all 0.2s ease"
	});
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: spacing.xs,
				padding: `${spacing.lg} ${spacing.xl}`,
				borderRadius: borderRadius.md,
				border: `1px solid ${colors.borderMedium}`,
				background: colors.bgPanel,
				boxShadow: colors.shadowLarge,
				width: "100%"
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<div style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Layer Presets</div>
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
			<label 
				style={rowStyle(preset === "terrain")}
				onMouseEnter={(e) => {
					if (preset !== "terrain") {
						e.currentTarget.style.background = colors.bgButton;
					}
				}}
				onMouseLeave={(e) => {
					if (preset !== "terrain") {
						e.currentTarget.style.background = colors.bgSecondary;
					}
				}}
			>
				<span>Terrain Only</span>
				<input
					type="checkbox"
					checked={preset === "terrain"}
					onChange={() => setPreset(preset === "terrain" ? "everything" : "terrain")}
					style={{ accentColor: colors.primary, cursor: "pointer" }}
				/>
			</label>
			<label style={rowStyle(preset === "sign")}>
				<span>Sign Only</span>
				<input
					type="checkbox"
					checked={preset === "sign"}
					onChange={() => setPreset(preset === "sign" ? "everything" : "sign")}
				/>
			</label>
			<label style={rowStyle(preset === "hunts")}>
				<span>Hunts Only</span>
				<input
					type="checkbox"
					checked={preset === "hunts"}
					onChange={() => setPreset(preset === "hunts" ? "everything" : "hunts")}
				/>
			</label>
			<label style={rowStyle(preset === "everything")}>
				<span>Everything</span>
				<input
					type="checkbox"
					checked={preset === "everything"}
					onChange={() => setPreset("everything")}
				/>
			</label>
			<hr style={{ border: "none", borderTop: `1px solid ${colors.borderMedium}`, margin: `${spacing.sm} 0` }} />
			<label style={rowStyle(temporalView === "permanentOnly")}>
				<span>Historical (Permanent)</span>
				<input
					type="checkbox"
					checked={temporalView === "permanentOnly"}
					onChange={() => {
						if (temporalView === "permanentOnly") {
							setTemporalView("all");
							setPreset("everything");
						} else {
							setTemporalView("permanentOnly");
							setPreset("terrain");
						}
					}}
				/>
			</label>
			<label style={rowStyle(preset === "hunts" && onlyMine === false)}>
				<span>Kills</span>
				<input
					type="checkbox"
					checked={preset === "hunts" && onlyMine === false}
					onChange={() => {
						// Focus on harvests
						setPreset("hunts");
						setOnlyMine(false);
						const target: LayerId = "harvests";
						const others: LayerId[] = ["hunts", "animal_sightings", "animal_paths", "stands"];
						setLayerOverride(target, true);
						others.forEach((id) => setLayerOverride(id, false));
					}}
				/>
			</label>
			<label style={rowStyle(preset === "hunts" && onlyMine === true)}>
				<span>My Kills</span>
				<input
					type="checkbox"
					checked={preset === "hunts" && onlyMine === true}
					onChange={() => {
						setPreset("hunts");
						setOnlyMine(true);
						const target: LayerId = "harvests";
						const others: LayerId[] = ["hunts", "animal_sightings", "animal_paths", "stands"];
						setLayerOverride(target, true);
						others.forEach((id) => setLayerOverride(id, false));
					}}
				/>
			</label>
			<label style={rowStyle(preset === "sign")}>
				<span>Bear Sign</span>
				<input
					type="checkbox"
					checked={preset === "sign"}
					onChange={() => {
						setPreset("sign");
						setSpecies(["bear"]);
						// reset overrides to default for sign preset
						const overrides: Partial<Record<LayerId, boolean>> = {};
						// We do not clear explicitly here; user can adjust in Legend
					}}
				/>
			</label>
			<label style={rowStyle(preset === "sign")}>
				<span>Turkey Sign</span>
				<input
					type="checkbox"
					checked={preset === "sign"}
					onChange={() => {
						setPreset("sign");
						setSpecies(["turkey"]);
					}}
				/>
			</label>
			<hr style={{ border: "none", borderTop: `1px solid ${colors.borderMedium}`, margin: `${spacing.sm} 0` }} />
			<label style={rowStyle(timeWindow === "1y")}>
				<span>1 Year</span>
				<input
					type="checkbox"
					checked={timeWindow === "1y"}
					onChange={() => setTimeWindow(timeWindow === "1y" ? "all" : "1y")}
				/>
			</label>
			<label style={rowStyle(timeWindow === "5y")}>
				<span>5 Years</span>
				<input
					type="checkbox"
					checked={timeWindow === "5y"}
					onChange={() => setTimeWindow(timeWindow === "5y" ? "all" : "5y")}
				/>
			</label>
			<label style={rowStyle(timeWindow === "all")}>
				<span>All Time</span>
				<input
					type="checkbox"
					checked={timeWindow === "all"}
					onChange={() => setTimeWindow("all")}
				/>
			</label>
		</div>
	);
}


