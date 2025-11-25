import { useState } from "react";
import { layerConfigById, layerOrder } from "../lib/geo/layerConfig";
import type { LayerId } from "../lib/geo/schema";
import { useVisibilityStore } from "../state/visibility";
import { shallow } from "zustand/shallow";

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
	tree_stands: "stands",
	open_woods: "habitat",
	cover_points: "habitat",
	acorn_flats: "habitat",
	bedding_areas: "habitat",
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
	const [open, setOpen] = useState(false);
	const [openCategories, setOpenCategories] = useState<Record<CategoryKey, boolean>>(() => {
		const initial: Record<CategoryKey, boolean> = {} as Record<CategoryKey, boolean>;
		for (const cat of legendCategories) {
			// Collapse Property by default; others expanded
			initial[cat.key] = cat.key !== "property";
		}
		return initial;
	});

	if (!open) {
		return (
			<button
				onClick={() => setOpen(true)}
				style={{
					position: "fixed",
					left: 12,
					top: 12,
					padding: "8px 14px",
					borderRadius: 6,
					border: "1px solid rgba(15,23,42,0.12)",
					background: "#ffffff",
					fontSize: 13,
					zIndex: 1000,
					cursor: "pointer",
					boxShadow: "0 6px 18px rgba(15,23,42,0.12)"
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
				padding: "12px 14px",
				background: "rgba(255,255,255,0.94)",
				border: "1px solid rgba(15, 23, 42, 0.12)",
				borderRadius: 6,
				boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
				zIndex: 1100,
				minWidth: 220
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<strong style={{ fontSize: 14 }}>Legend</strong>
				<button
					onClick={() => setOpen(false)}
					style={{
						border: "none",
						background: "transparent",
						fontSize: 12,
						color: "rgba(0,0,0,0.6)",
						cursor: "pointer"
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
								border: "1px solid rgba(15,23,42,0.12)",
								borderRadius: 6,
								overflow: "hidden",
								background: "rgba(247,249,252,0.85)"
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
									padding: "8px 10px",
									background: "rgba(255,255,255,0.95)",
									border: "none",
									outline: "none",
									cursor: "pointer",
									fontSize: 12,
									fontWeight: 600,
									color: "rgba(15,23,42,0.75)"
								}}
							>
								<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
									<span>{category.icon}</span>
									{category.title}
								</span>
								<span style={{ fontSize: 12, color: "rgba(15,23,42,0.55)" }}>
									{expanded ? "▾" : "▸"}
								</span>
							</button>
							{expanded ? (
								<div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px" }}>
									{category.layerIds.map((id) => {
										const cfg = layerConfigById[id];
										// Show small/large swatch examples for dynamic layers
										const isDynamic = ["trees_points", "big_rocks"].includes(id);
										return (
											<div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
												<input type="checkbox" checked={isVisible(id)} onChange={(e) => setOverride(id, e.target.checked)} style={{ accentColor: "#3b82f6" }} />
												<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
													{cfg.icon && <span style={{ fontSize: 16 }}>{cfg.icon}</span>}
													<span>{cfg.label}</span>
												</span>
												{isDynamic && <div style={{ fontSize: 10, color: "rgba(15,23,42,0.55)" }}> (Small | Large)</div>}
												{cfg.addable && <button onClick={() => window.dispatchEvent(new Event(`add-feature-${id}`))} style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px" }}>Add</button>}
											</div>
										);
									})}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}


