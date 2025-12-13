import { useState } from "react";
import type { CSSProperties } from "react";
import { useFiltersStore } from "../state/filters";
import { useVisibilityStore } from "../state/visibility";
import { useHistoricalImagery } from "../state/historical";
import { colors, borderRadius, spacing, typography } from "../lib/theme";

const chip = (active: boolean): CSSProperties => ({
	padding: `${spacing.xs} ${spacing.md}`,
	borderRadius: borderRadius.full,
	border: `1px solid ${active ? colors.primaryBorder : colors.borderStrong}`,
	background: active ? colors.primaryLight : colors.bgSecondary,
	color: active ? colors.primary : colors.textPrimary,
	cursor: "pointer",
	userSelect: "none",
	fontSize: typography.fontSize.sm,
	fontWeight: active ? typography.fontWeight.semibold : typography.fontWeight.medium,
	transition: "all 0.2s ease"
});

const speciesOptions = ["whitetail", "turkey", "bear", "fisher", "coyote", "bobcat", "other"];
const signTypeOptions = ["scat", "tracks", "bed", "rub", "scrape", "feathers", "kill_site", "hair", "other"];

export default function FiltersPanel() {
	const [open, setOpen] = useState(false);
	const species = useFiltersStore((s) => s.species);
	const toggleSpecies = useFiltersStore((s) => s.toggleSpecies);
	const signTypes = useFiltersStore((s) => s.signTypes);
	const toggleSignType = useFiltersStore((s) => s.toggleSignType);
	const onlyMine = useFiltersStore((s) => s.onlyMine);
	const setOnlyMine = useFiltersStore((s) => s.setOnlyMine);
	const temporalView = useFiltersStore((s) => s.temporalView);
	const setTemporalView = useFiltersStore((s) => s.setTemporalView);
	const timeWindow = useVisibilityStore((s) => s.timeWindow);
	const setTimeWindow = useVisibilityStore((s) => s.setTimeWindow);
	const clear = useFiltersStore((s) => s.clear);

	if (!open) {
		return (
			<button
				onClick={() => setOpen(true)}
				style={{
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
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = colors.bgButtonHover;
					e.currentTarget.style.boxShadow = colors.shadowMedium;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = colors.bgButton;
					e.currentTarget.style.boxShadow = colors.shadowSubtle;
				}}
			>
				Filters
			</button>
		);
	}

	return (
		<div style={{
			padding: `${spacing.lg} ${spacing.xl}`,
			borderRadius: borderRadius.md,
			border: `1px solid ${colors.borderMedium}`,
			background: colors.bgPanel,
			boxShadow: colors.shadowLarge,
			width: "100%",
			fontSize: typography.fontSize.sm,
			color: colors.textPrimary
		}}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<div
					onClick={() => setOpen(false)}
					style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
					title="Click to collapse"
				>
					<span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Filters</span>
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
				<div style={{ display: "flex", gap: spacing.sm }}>
					<button
						onClick={() => clear()}
						style={{
							border: `1px solid ${colors.borderMedium}`,
							background: colors.bgPanelSolid,
							fontSize: typography.fontSize.xs,
							cursor: "pointer",
							borderRadius: borderRadius.sm,
							padding: `${spacing.xs} ${spacing.sm}`,
							color: colors.textSecondary,
							fontWeight: typography.fontWeight.medium,
							transition: "all 0.2s ease"
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = colors.bgButton;
							e.currentTarget.style.color = colors.textPrimary;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = colors.bgPanelSolid;
							e.currentTarget.style.color = colors.textSecondary;
						}}
					>
						Clear
					</button>
				</div>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: spacing.md, marginTop: spacing.md }}>
				<div>
					<div style={{ marginBottom: spacing.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Species</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
						{speciesOptions.map((sp) => {
							const active = species.has(sp);
							return (
								<span 
									key={sp} 
									style={chip(active)} 
									onClick={() => toggleSpecies(sp)}
									onMouseEnter={(e) => {
										if (!active) {
											e.currentTarget.style.background = colors.bgButton;
											e.currentTarget.style.borderColor = colors.border;
										}
									}}
									onMouseLeave={(e) => {
										if (!active) {
											e.currentTarget.style.background = colors.bgSecondary;
											e.currentTarget.style.borderColor = colors.borderStrong;
										}
									}}
								>
									{sp}
								</span>
							);
						})}
					</div>
				</div>
				<div>
					<div style={{ marginBottom: spacing.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Sign type</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: spacing.sm }}>
						{signTypeOptions.map((st) => {
							const active = signTypes.has(st);
							return (
								<span 
									key={st} 
									style={chip(active)} 
									onClick={() => toggleSignType(st)}
									onMouseEnter={(e) => {
										if (!active) {
											e.currentTarget.style.background = colors.bgButton;
											e.currentTarget.style.borderColor = colors.border;
										}
									}}
									onMouseLeave={(e) => {
										if (!active) {
											e.currentTarget.style.background = colors.bgSecondary;
											e.currentTarget.style.borderColor = colors.borderStrong;
										}
									}}
								>
									{st}
								</span>
							);
						})}
					</div>
				</div>
				<label style={{ display: "flex", alignItems: "center", gap: spacing.md, cursor: "pointer", color: colors.textPrimary }}>
					<input 
						type="checkbox" 
						checked={onlyMine} 
						onChange={(e) => setOnlyMine(e.target.checked)}
						style={{ accentColor: colors.primary, cursor: "pointer" }}
					/>
					Only mine
				</label>
				<hr style={{ border: "none", borderTop: `1px solid ${colors.borderMedium}` }} />
				<div style={{ display: "flex", alignItems: "center", gap: spacing.lg, flexWrap: "wrap" }}>
					<div style={{ fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Time</div>
					<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
						<input
							type="radio"
							name="tw"
							checked={timeWindow === "all" && temporalView === "all"}
							onChange={() => {
								setTimeWindow("all");
								setTemporalView("all");
							}}
							style={{ accentColor: colors.primary, cursor: "pointer" }}
						/>
						All
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
						<input
							type="radio"
							name="tw"
							checked={timeWindow === "1y"}
							onChange={() => {
								setTimeWindow("1y");
								setTemporalView("all");
							}}
							style={{ accentColor: colors.primary, cursor: "pointer" }}
						/>
						1 year
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
						<input
							type="radio"
							name="tw"
							checked={timeWindow === "5y"}
							onChange={() => {
								setTimeWindow("5y");
								setTemporalView("all");
							}}
							style={{ accentColor: colors.primary, cursor: "pointer" }}
						/>
						5 years
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
						<input
							type="radio"
							name="tw"
							checked={temporalView === "permanentOnly"}
							onChange={() => {
								setTemporalView("permanentOnly");
								setTimeWindow("all");
							}}
							style={{ accentColor: colors.primary, cursor: "pointer" }}
						/>
						Historical (permanent)
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: spacing.sm, cursor: "pointer", color: colors.textPrimary }}>
						<input
							type="radio"
							name="tw"
							checked={temporalView === "recentOnly"}
							onChange={() => {
								setTemporalView("recentOnly");
								setTimeWindow("all");
							}}
							style={{ accentColor: colors.primary, cursor: "pointer" }}
						/>
						Recent only
					</label>
				</div>
			</div>
		</div>
	);
}


