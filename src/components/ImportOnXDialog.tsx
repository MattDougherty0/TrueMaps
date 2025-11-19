import { useEffect, useState } from "react";

type TracksTarget = "trails" | "animal_paths";

export default function ImportOnXDialog({
	visible,
	defaultTracksTarget,
	defaultTimeZone,
	defaultUseHeuristics,
	defaultOnlyPoints,
	onCancel,
	onConfirm
}: {
	visible: boolean;
	defaultTracksTarget?: TracksTarget;
	defaultTimeZone?: string;
	defaultUseHeuristics?: boolean;
	defaultOnlyPoints?: boolean;
	onCancel: () => void;
	onConfirm: (opts: { tracksTarget: TracksTarget; timeZone: string; useHeuristics: boolean; onlyPoints?: boolean }) => void;
}) {
	const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
	const [tracksTarget, setTracksTarget] = useState<TracksTarget>(defaultTracksTarget || "trails");
	const [timeZone, setTimeZone] = useState<string>(defaultTimeZone || systemTz);
	const [useHeuristics, setUseHeuristics] = useState<boolean>(
		typeof defaultUseHeuristics === "boolean" ? defaultUseHeuristics : true
	);
	const [onlyPoints, setOnlyPoints] = useState<boolean>(!!defaultOnlyPoints);

	useEffect(() => {
		if (!visible) return;
		setTracksTarget(defaultTracksTarget || "trails");
		setTimeZone(defaultTimeZone || systemTz);
		setUseHeuristics(typeof defaultUseHeuristics === "boolean" ? defaultUseHeuristics : true);
		setOnlyPoints(!!defaultOnlyPoints);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visible]);

	if (!visible) return null;
	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				background: "rgba(0,0,0,0.35)",
				zIndex: 2000,
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			}}
		>
			<div
				style={{
					width: 420,
					maxWidth: "90vw",
					background: "#ffffff",
					borderRadius: 10,
					boxShadow: "0 10px 30px rgba(15,23,42,0.22)",
					border: "1px solid rgba(15,23,42,0.12)",
					padding: 16
				}}
			>
				<div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Import onX Options</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						<span style={{ fontSize: 12, color: "#334155" }}>Tracks target</span>
						<div style={{ display: "flex", gap: 12 }}>
							<label style={{ display: "flex", alignItems: "center", gap: 6 }}>
								<input
									type="radio"
									name="tracksTarget"
									checked={tracksTarget === "trails"}
									onChange={() => setTracksTarget("trails")}
								/>
								<span>Trails</span>
							</label>
							<label style={{ display: "flex", alignItems: "center", gap: 6 }}>
								<input
									type="radio"
									name="tracksTarget"
									checked={tracksTarget === "animal_paths"}
									onChange={() => setTracksTarget("animal_paths")}
								/>
								<span>Animal paths</span>
							</label>
						</div>
					</label>
					<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
						<span style={{ fontSize: 12, color: "#334155" }}>Time zone for GPX timestamps</span>
						<input
							type="text"
							value={timeZone}
							onChange={(e) => setTimeZone(e.target.value)}
							placeholder="e.g., America/New_York"
							style={{
								border: "1px solid rgba(15,23,42,0.18)",
								borderRadius: 6,
								padding: "8px 10px",
								fontSize: 13
							}}
						/>
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<input
							type="checkbox"
							checked={useHeuristics}
							onChange={(e) => setUseHeuristics(e.target.checked)}
						/>
						<span>Use heuristic mapping from names</span>
					</label>
					<label style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<input
							type="checkbox"
							checked={onlyPoints}
							onChange={(e) => setOnlyPoints(e.target.checked)}
						/>
						<span>Points only (skip lines and polygons)</span>
					</label>
				</div>
				<div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
					<button
						onClick={onCancel}
						style={{
							padding: "8px 12px",
							borderRadius: 6,
							border: "1px solid rgba(15,23,42,0.12)",
							background: "#ffffff",
							cursor: "pointer",
							fontSize: 13
						}}
					>
						Cancel
					</button>
					<button
						onClick={() => onConfirm({ tracksTarget, timeZone, useHeuristics, onlyPoints })}
						style={{
							padding: "8px 12px",
							borderRadius: 6,
							border: "1px solid #0a84ff",
							background: "#0a84ff",
							color: "#ffffff",
							cursor: "pointer",
							fontSize: 13,
							fontWeight: 600
						}}
					>
						Continue
					</button>
				</div>
			</div>
		</div>
	);
}


