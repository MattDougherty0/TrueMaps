import { useState } from "react";
import type { CSSProperties } from "react";
import { useFiltersStore } from "../state/filters";
import { useVisibilityStore } from "../state/visibility";
import { useHistoricalImagery } from "../state/historical";

const containerStyle: CSSProperties = {
	padding: "10px 12px",
	borderRadius: 6,
	border: "1px solid rgba(15, 23, 42, 0.12)",
	background: "rgba(255, 255, 255, 0.94)",
	boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
	width: "100%",
	fontSize: 12,
	color: "rgba(15,23,42,0.75)"
};

const chip = (active: boolean): CSSProperties => ({
	padding: "4px 8px",
	borderRadius: 999,
	border: `1px solid ${active ? "rgba(10,132,255,0.45)" : "rgba(15,23,42,0.15)"}`,
	background: active ? "rgba(10,132,255,0.12)" : "rgba(247,249,252,0.9)",
	color: active ? "#0a84ff" : "rgba(15,23,42,0.75)",
	cursor: "pointer",
	userSelect: "none"
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
				}}
			>
				Filters
			</button>
		);
	}

	return (
		<div style={containerStyle}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<div
					onClick={() => setOpen(false)}
					style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
					title="Click to collapse"
				>
					<span style={{ fontSize: 12, fontWeight: 600 }}>Filters</span>
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
				<div style={{ display: "flex", gap: 6 }}>
					<button
						onClick={() => clear()}
						style={{
							border: "1px solid rgba(15,23,42,0.12)",
							background: "rgba(255,255,255,0.96)",
							fontSize: 11,
							cursor: "pointer",
							borderRadius: 4,
							padding: "2px 6px"
						}}
					>
						Clear
					</button>
				</div>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
				<div>
					<div style={{ marginBottom: 6, fontWeight: 600 }}>Species</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
						{speciesOptions.map((sp) => {
							const active = species.has(sp);
							return (
								<span key={sp} style={chip(active)} onClick={() => toggleSpecies(sp)}>
									{sp}
								</span>
							);
						})}
					</div>
				</div>
				<div>
					<div style={{ marginBottom: 6, fontWeight: 600 }}>Sign type</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
						{signTypeOptions.map((st) => {
							const active = signTypes.has(st);
							return (
								<span key={st} style={chip(active)} onClick={() => toggleSignType(st)}>
									{st}
								</span>
							);
						})}
					</div>
				</div>
				<label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
					<input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
					Only mine
				</label>
				<hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.12)" }} />
				<div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
					<div style={{ fontWeight: 600 }}>Time</div>
					<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
						<input
							type="radio"
							name="tw"
							checked={timeWindow === "all" && temporalView === "all"}
							onChange={() => {
								setTimeWindow("all");
								setTemporalView("all");
							}}
						/>
						All
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
						<input
							type="radio"
							name="tw"
							checked={timeWindow === "1y"}
							onChange={() => {
								setTimeWindow("1y");
								setTemporalView("all");
							}}
						/>
						1 year
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
						<input
							type="radio"
							name="tw"
							checked={timeWindow === "5y"}
							onChange={() => {
								setTimeWindow("5y");
								setTemporalView("all");
							}}
						/>
						5 years
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
						<input
							type="radio"
							name="tw"
							checked={temporalView === "permanentOnly"}
							onChange={() => {
								setTemporalView("permanentOnly");
								setTimeWindow("all");
							}}
						/>
						Historical (permanent)
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
						<input
							type="radio"
							name="tw"
							checked={temporalView === "recentOnly"}
							onChange={() => {
								setTemporalView("recentOnly");
								setTimeWindow("all");
							}}
						/>
						Recent only
					</label>
				</div>
			</div>
		</div>
	);
}


