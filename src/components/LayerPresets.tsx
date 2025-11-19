import { useState } from "react";
import type { CSSProperties } from "react";
import { useVisibilityStore } from "../state/visibility";
import { useFiltersStore } from "../state/filters";
import type { LayerId } from "../lib/geo/schema";

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
		padding: "6px 12px",
		borderRadius: 6,
		border: "1px solid rgba(15, 23, 42, 0.12)",
		background: "rgba(255, 255, 255, 0.92)",
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
				Layer Presets
			</button>
		);
	}

	const rowStyle = (active: boolean): CSSProperties => ({
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "6px 10px",
		borderRadius: 4,
		border: "1px solid rgba(15,23,42,0.12)",
		background: active ? "rgba(10,132,255,0.12)" : "#f7f9fc",
		fontSize: 12,
		color: active ? "#0a84ff" : "rgba(15,23,42,0.75)",
		fontWeight: active ? 600 : 500
	});
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 4,
				padding: "12px 14px",
				borderRadius: 6,
				border: "1px solid rgba(15, 23, 42, 0.12)",
				background: "rgba(255, 255, 255, 0.94)",
				boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
				width: "100%"
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<div style={{ fontSize: 13, fontWeight: 600, color: "rgba(15,23,42,0.75)" }}>Layer Presets</div>
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
			<label style={rowStyle(preset === "terrain")}>
				<span>Terrain Only</span>
				<input
					type="checkbox"
					checked={preset === "terrain"}
					onChange={() => setPreset(preset === "terrain" ? "everything" : "terrain")}
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
			<hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.12)", margin: "6px 0" }} />
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
			<hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.12)", margin: "6px 0" }} />
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


