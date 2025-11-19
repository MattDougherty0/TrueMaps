import { useState } from "react";
import type { CSSProperties } from "react";
import { useAnalyticsStore } from "../state/analytics";

export default function AnalyticsToggles() {
	const [open, setOpen] = useState(false);
	const showSightingsHeatmap = useAnalyticsStore((s) => s.showSightingsHeatmap);
	const setShowSightingsHeatmap = useAnalyticsStore((s) => s.setShowSightingsHeatmap);
	const showPathDensity = useAnalyticsStore((s) => s.showPathDensity);
	const setShowPathDensity = useAnalyticsStore((s) => s.setShowPathDensity);
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
				Analytics
			</button>
		);
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "10px 12px",
				borderRadius: 6,
				border: "1px solid rgba(15, 23, 42, 0.12)",
				background: "rgba(255, 255, 255, 0.94)",
				boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
				width: "100%",
				fontSize: 12,
				color: "rgba(15,23,42,0.75)"
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<span style={{ fontSize: 12, fontWeight: 600 }}>Analytics</span>
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
			<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
				<input
					type="checkbox"
					checked={showSightingsHeatmap}
					onChange={(e) => setShowSightingsHeatmap(e.target.checked)}
				/>
				Sightings Heatmap
			</label>
			<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
				<input
					type="checkbox"
					checked={showPathDensity}
					onChange={(e) => setShowPathDensity(e.target.checked)}
				/>
				Path Density
			</label>
		</div>
	);
}


