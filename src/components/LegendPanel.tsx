import { useState } from "react";
import { layerConfigById, layerOrder } from "../lib/geo/layerConfig";
import type { LayerId } from "../lib/geo/schema";
import { useVisibilityStore } from "../state/visibility";
import { useTrackVisibilityStore } from "../state/trackVisibility";
import { shallow } from "zustand/shallow";
import { colors, borderRadius, spacing, typography } from "../lib/theme";

type CategoryKey = "property" | "terrain" | "habitat" | "animal" | "stands";

const categoryDefinitions: Array<{ key: CategoryKey; title: string; icon: string }> = [
	{ key: "property", title: "Property", icon: "📐" },
	{ key: "animal", title: "Animal Sign", icon: "🦌" }, // move Animal Sign just under Property
	{ key: "terrain", title: "Terrain & Access", icon: "🗺️" },
	{ key: "habitat", title: "Habitat & Food", icon: "🌲" },
	{ key: "stands", title: "Stands & Hunts", icon: "🎯" }
];

const categoryLookup: Record<LayerId, CategoryKey> = {
	property_boundary: "property",
	streams: "terrain",
	cliffs: "terrain",
	ravines: "terrain",
	trails: "terrain",
	waypoints: "terrain",
	tree_stands: "stands",
	trail_cameras: "stands",
	open_woods: "habitat",
	acorn_flats: "habitat",
	thick_bedding: "habitat",
	trees_points: "habitat",
	beds_points: "animal",
	mast_check_points: "habitat",
	big_rocks: "terrain",
	scrapes: "animal",
	rubs: "animal",
	stands: "stands",
	animal_sign: "animal",
	animal_paths: "animal",
	hunts: "stands",
	harvests: "stands",
	animal_sightings: "animal"
};

const legendCategories = categoryDefinitions
	.map((def) => ({
		...def,
		layerIds: layerOrder.filter((id) => categoryLookup[id] === def.key)
	}))
	.filter((cat) => cat.layerIds.length > 0);

export default function LegendPanel() {
	const setOverride = useVisibilityStore((s) => s.setLayerOverride);
	const isVisible = useVisibilityStore((s) => s.isLayerVisible);
	// Subscribe to preset and overrides so the legend rerenders immediately on changes
	const [presetValue, overrides] = useVisibilityStore((s) => [s.preset, s.overrides], shallow);
	
	// Track visibility state
	const tracks = useTrackVisibilityStore((s) => s.tracks);
	const setTrackVisible = useTrackVisibilityStore((s) => s.setTrackVisible);
	const setAllTracksVisible = useTrackVisibilityStore((s) => s.setAllTracksVisible);
	
	const [open, setOpen] = useState(false);
	const [humanTracksOpen, setHumanTracksOpen] = useState(false);
	const [openCategories, setOpenCategories] = useState<Record<CategoryKey, boolean>>(() => {
		const initial: Record<CategoryKey, boolean> = {} as Record<CategoryKey, boolean>;
		for (const cat of legendCategories) {
			// Collapse Property by default; others expanded
			initial[cat.key] = cat.key !== "property";
		}
		return initial;
	});
	
	// Calculate if all tracks are visible for the "toggle all" checkbox
	const allTracksVisible = tracks.length > 0 && tracks.every((t) => t.visible);
	const someTracksVisible = tracks.some((t) => t.visible);

	if (!open) {
		return (
			<button
				onClick={() => setOpen(true)}
				style={{
					position: "fixed",
					left: 12,
					top: 12,
					padding: `${spacing.md} ${spacing.xl}`,
					borderRadius: borderRadius.md,
					border: `1px solid ${colors.borderMedium}`,
					background: colors.bgPanelSolid,
					fontSize: typography.fontSize.base,
					fontWeight: typography.fontWeight.medium,
					color: colors.textPrimary,
					zIndex: 1000,
					cursor: "pointer",
					boxShadow: colors.shadowMedium,
					transition: "all 0.2s ease"
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = colors.bgButtonHover;
					e.currentTarget.style.boxShadow = colors.shadowLarge;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = colors.bgPanelSolid;
					e.currentTarget.style.boxShadow = colors.shadowMedium;
				}}
			>
				Show layers
			</button>
		);
	}

	return (
		<div
			data-preset={presetValue}
			style={{
				position: "fixed",
				left: 12,
				top: 12,
				maxHeight: "70vh",
				overflow: "auto",
				padding: `${spacing.lg} ${spacing.xl}`,
				background: colors.bgPanel,
				border: `1px solid ${colors.borderMedium}`,
				borderRadius: borderRadius.md,
				boxShadow: colors.shadowLarge,
				zIndex: 1100,
				minWidth: 220
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<strong style={{ fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Legend</strong>
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
			<div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
				{legendCategories.map((category) => {
					const expanded = openCategories[category.key] ?? true;
					return (
						<div
							key={category.key}
							style={{
								border: `1px solid ${colors.borderMedium}`,
								borderRadius: borderRadius.md,
								overflow: "hidden",
								background: colors.bgSecondary
							}}
						>
							<button
								onClick={() =>
									setOpenCategories((prev) => ({
										...prev,
										[category.key]: !(prev[category.key] ?? true)
									}))
								}
								style={{
									width: "100%",
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: `${spacing.md} ${spacing.lg}`,
									background: colors.bgPanelSolid,
									border: "none",
									outline: "none",
									cursor: "pointer",
									fontSize: typography.fontSize.sm,
									fontWeight: typography.fontWeight.semibold,
									color: colors.textPrimary,
									transition: "all 0.2s ease"
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = colors.bgButtonHover;
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = colors.bgPanelSolid;
								}}
							>
								<span style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
									<span>{category.icon}</span>
									{category.title}
								</span>
								<span style={{ fontSize: typography.fontSize.sm, color: colors.textLight }}>
									{expanded ? "▾" : "▸"}
								</span>
							</button>
							{expanded ? (
								<div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, padding: `${spacing.md} ${spacing.lg}` }}>
									{category.layerIds.map((id) => {
										const cfg = layerConfigById[id];
										// Show small/large swatch examples for dynamic layers
										const isDynamic = ["trees_points", "big_rocks"].includes(id);
										return (
											<div key={id} style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
												<input 
													type="checkbox" 
													checked={isVisible(id)} 
													onChange={(e) => setOverride(id, e.target.checked)} 
													style={{ accentColor: colors.primary, cursor: "pointer" }} 
												/>
												<span style={{ display: "flex", alignItems: "center", gap: spacing.sm, flex: 1, color: colors.textPrimary }}>
													{cfg.icon && <span style={{ fontSize: 16 }}>{cfg.icon}</span>}
													<span>{cfg.label}</span>
												</span>
												{isDynamic && <div style={{ fontSize: typography.fontSize.xs, color: colors.textLight }}> (Small | Large)</div>}
												{cfg.addable && (
													<button 
														onClick={() => window.dispatchEvent(new Event(`add-feature-${id}`))} 
														style={{ 
															marginLeft: "auto", 
															fontSize: typography.fontSize.xs, 
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
												)}
											</div>
										);
									})}
									{/* Human Tracks dropdown - only show in Terrain category */}
									{category.key === "terrain" && tracks.length > 0 && (
										<div style={{ 
											marginTop: spacing.sm, 
											border: `1px solid ${colors.border}`,
											borderRadius: borderRadius.sm,
											overflow: "hidden"
										}}>
											<div
												style={{
													width: "100%",
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
													padding: `${spacing.sm} ${spacing.md}`,
													background: colors.bgButton,
													fontSize: typography.fontSize.sm,
													color: colors.textPrimary
												}}
											>
												<span style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
													<input
														type="checkbox"
														checked={allTracksVisible}
														ref={(el) => {
															if (el) el.indeterminate = someTracksVisible && !allTracksVisible;
														}}
														onChange={(e) => {
															e.stopPropagation();
															setAllTracksVisible(e.target.checked);
														}}
														style={{ accentColor: colors.primary, cursor: "pointer" }}
													/>
													<span>🚶</span>
													<span 
														onClick={() => setHumanTracksOpen(!humanTracksOpen)}
														style={{ cursor: "pointer" }}
													>
														Human Tracks ({tracks.length})
													</span>
												</span>
												<span 
													onClick={() => setHumanTracksOpen(!humanTracksOpen)}
													style={{ 
														fontSize: typography.fontSize.xs, 
														color: colors.textLight,
														cursor: "pointer",
														padding: `${spacing.xs} ${spacing.sm}`
													}}
												>
													{humanTracksOpen ? "▾" : "▸"}
												</span>
											</div>
											{humanTracksOpen && (
												<div style={{ 
													padding: `${spacing.sm} ${spacing.md}`,
													background: colors.bgSecondary,
													display: "flex",
													flexDirection: "column",
													gap: spacing.xs,
													maxHeight: 200,
													overflowY: "auto"
												}}>
													{/* Individual track checkboxes */}
													{tracks.map((track) => (
														<div 
															key={track.id} 
															style={{ 
																display: "flex", 
																alignItems: "center", 
																gap: spacing.sm 
															}}
														>
															<input
																type="checkbox"
																checked={track.visible}
																onChange={(e) => setTrackVisible(track.id, e.target.checked)}
																style={{ accentColor: colors.primary, cursor: "pointer" }}
															/>
															<span style={{ 
																fontSize: typography.fontSize.xs, 
																color: colors.textPrimary,
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
																maxWidth: 150
															}} title={track.name}>
																{track.name}
															</span>
														</div>
													))}
												</div>
											)}
										</div>
									)}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}


