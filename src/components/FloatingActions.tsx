import { useMemo, useState, type CSSProperties } from "react";
import { layerConfigById } from "../lib/geo/layerConfig";
import type { LayerId } from "../lib/geo/schema";

const categoryStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	padding: 8,
	borderRadius: 6,
	background: "rgba(255,255,255,0.95)",
	border: "1px solid rgba(0,0,0,0.08)"
};

const itemButtonStyle: CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 8,
	padding: "6px 10px",
	background: "#f7f7f7",
	borderRadius: 6,
	border: "1px solid rgba(0,0,0,0.06)",
	fontSize: 13,
	cursor: "pointer",
	justifyContent: "flex-start"
};

const primaryButtonStyle: CSSProperties = {
	padding: "10px 16px",
	borderRadius: 999,
	background: "#0a84ff",
	color: "#fff",
	border: "none",
	fontSize: 15,
	fontWeight: 600,
	cursor: "pointer",
	boxShadow: "0 12px 24px rgba(10,132,255,0.25)"
};

function fire(layerId: LayerId) {
	window.dispatchEvent(new Event(`add-feature-${layerId}`));
}

export default function FloatingActions() {
	const [open, setOpen] = useState(false);

	const startTrailDraw = () => {
		window.dispatchEvent(new Event("start-trail-draw"));
	};
	const deleteSelectedTrail = () => {
		window.dispatchEvent(new Event("delete-selected-trail"));
	};
	const newHunt = () => {
		window.dispatchEvent(new Event("start-new-hunt"));
	};
	const newHarvest = () => {
		window.dispatchEvent(new Event("start-new-harvest"));
	};
	const newSighting = () => {
		window.dispatchEvent(new Event("start-new-sighting"));
	};
	const newAnimalSign = () => {
		window.dispatchEvent(new Event("start-new-animal-sign"));
	};
	const newAnimalPath = () => {
		window.dispatchEvent(new Event("start-new-animal-path"));
	};

	const closeAnd = (fn: () => void) => () => {
		fn();
		setOpen(false);
	};

	const categories = useMemo(
		() => [
			{
				title: "Animal Sign",
				icon: "🦌",
				items: [
					{ layerId: "scrapes" as LayerId },
					{ layerId: "rubs" as LayerId },
					{ layerId: "beds_points" as LayerId },
					{ label: layerConfigById.animal_sign.label, icon: layerConfigById.animal_sign.icon, onClick: closeAnd(newAnimalSign) },
					{ label: layerConfigById.animal_sightings.label, icon: layerConfigById.animal_sightings.icon, onClick: closeAnd(newSighting) },
					{ label: layerConfigById.animal_paths.label, icon: layerConfigById.animal_paths.icon, onClick: closeAnd(newAnimalPath) }
				]
			},
			{
				title: "Habitat & Food",
				icon: "🌲",
				items: [
					{ layerId: "bedding_areas" as LayerId },
					{ layerId: "open_woods" as LayerId },
					{ layerId: "cover_points" as LayerId },
					{ layerId: "acorn_flats" as LayerId },
					{ layerId: "mast_check_points" as LayerId },
					{ layerId: "trees_points" as LayerId }
				]
			},
			{
				title: "Terrain & Access",
				icon: "🗺️",
				items: [
					{ label: "Trail", icon: "🛤️", onClick: closeAnd(startTrailDraw) },
					{ layerId: "streams" as LayerId },
					{ layerId: "ravines" as LayerId },
					{ layerId: "cliffs" as LayerId },
					{ layerId: "big_rocks" as LayerId }
				]
			},
			{
				title: "Stands & Hunts",
				icon: "🎯",
				items: [
					{ layerId: "stands" as LayerId },
					{ layerId: "tree_stands" as LayerId },
					{ label: layerConfigById.hunts.label, icon: layerConfigById.hunts.icon, onClick: closeAnd(newHunt) },
					{ label: layerConfigById.harvests.label, icon: layerConfigById.harvests.icon, onClick: closeAnd(newHarvest) }
				]
			}
		],
		[]
	);

	const renderItem = (item: { layerId?: LayerId; label?: string; icon?: string; onClick?: () => void }) => {
		const cfg = item.layerId ? layerConfigById[item.layerId] : undefined;
		const label = item.label ?? cfg?.label ?? "Add";
		const icon = item.icon ?? cfg?.icon ?? "+";
		const handler = item.onClick ?? closeAnd(() => fire(item.layerId!));
		return (
			<button key={label} style={itemButtonStyle} onClick={handler}>
				<span style={{ fontSize: 16 }}>{icon}</span>
				<span>{label}</span>
			</button>
		);
	};

	return (
		<div
			style={{
				position: "fixed",
				right: 16,
				bottom: 16,
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-end",
				gap: 10,
				zIndex: 1200
			}}
		>
			{open ? (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 12,
						background: "rgba(15,15,15,0.55)",
						padding: 12,
						borderRadius: 16,
						backdropFilter: "blur(12px)"
					}}
				>
					{categories.map((cat) => (
						<div key={cat.title} style={categoryStyle}>
							<div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
								<span>{cat.icon}</span>
								{cat.title}
							</div>
							<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
								{cat.items.map(renderItem)}
							</div>
							{cat.title === "Terrain & Access" ? (
								<button
									onClick={closeAnd(deleteSelectedTrail)}
									style={{
										...itemButtonStyle,
										background: "#ffecec",
										borderColor: "rgba(255,0,0,0.15)",
										color: "#c62828"
									}}
								>
									<span style={{ fontSize: 16 }}>🗑️</span>
									Delete Selected Trail
								</button>
							) : null}
						</div>
					))}
				</div>
			) : null}
			<button style={primaryButtonStyle} onClick={() => setOpen((s) => !s)}>
				{open ? "Close" : "Add Feature"}
			</button>
		</div>
	);
}

