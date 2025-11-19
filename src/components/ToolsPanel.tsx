import { useState } from "react";
import useAppStore from "../state/store";
import { exportGPX, exportZipOfGeoJSON } from "../lib/io/exports";
import { printCurrentMap } from "../lib/io/print";

export default function ToolsPanel() {
	const { projectPath } = useAppStore();
	const [open, setOpen] = useState(false);
	const [status, setStatus] = useState<string>("");
	if (!projectPath) return null;

	const runExport = async () => {
		setStatus("Exporting…");
		try {
			const [zipRel, gpxRel, gpkgRel] = await Promise.all([
				exportZipOfGeoJSON(projectPath),
				exportGPX(projectPath),
				window.api.exportGeoPackage(projectPath)
			]);
			const parts = [
				zipRel ? zipRel.split("/").pop() : null,
				gpxRel ? gpxRel.split("/").pop() : null,
				gpkgRel ? gpkgRel.split("/").pop() : null
			].filter(Boolean) as string[];
			setStatus(parts.length ? `Exported: ${parts.join(", ")}` : "Export complete");
		} catch {
			setStatus("Export failed");
		}
		setTimeout(() => setStatus(""), 4000);
	};

	const runPrint = async () => {
		setStatus("Printing…");
		try {
			const rel = await printCurrentMap(projectPath);
			setStatus(rel ? `Saved: ${rel.split("/").pop()}` : "Print failed");
		} catch {
			setStatus("Print failed");
		}
		setTimeout(() => setStatus(""), 4000);
	};

	const commonButton = {
		padding: "8px 12px",
		borderRadius: 6,
		border: "1px solid rgba(15,23,42,0.12)",
		background: "#ffffff",
		cursor: "pointer",
		fontSize: 12
	} as React.CSSProperties;

	return open ? (
		<div
			style={{
				position: "fixed",
				right: 16,
				bottom: 16,
				padding: 12,
				borderRadius: 10,
				border: "1px solid rgba(15,23,42,0.12)",
				background: "rgba(255,255,255,0.96)",
				boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
				zIndex: 1200,
				display: "flex",
				flexDirection: "column",
				gap: 8,
				minWidth: 220
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<strong style={{ fontSize: 12, color: "rgba(15,23,42,0.8)" }}>Tools</strong>
				<button
					onClick={() => setOpen(false)}
					style={{ border: "none", background: "transparent", fontSize: 12, cursor: "pointer", color: "rgba(15,23,42,0.6)" }}
				>
					Hide
				</button>
			</div>
			<button
				onClick={() => {
					window.dispatchEvent(new Event("boundarytools:open"));
					setOpen(false);
				}}
				style={commonButton}
			>
				Boundary Tools
			</button>
			<button onClick={() => void runExport()} style={commonButton}>
				Export
			</button>
			<button onClick={() => void runPrint()} style={commonButton}>
				Print Map
			</button>
			{status ? <div style={{ fontSize: 11, color: "#334155" }}>{status}</div> : null}
		</div>
	) : (
		<button
			onClick={() => setOpen(true)}
			style={{
				position: "fixed",
				right: 16,
				bottom: 16,
				padding: "8px 14px",
				borderRadius: 6,
				border: "1px solid rgba(15,23,42,0.12)",
				background: "#ffffff",
				cursor: "pointer",
				fontSize: 13,
				fontWeight: 500,
				zIndex: 1200,
				boxShadow: "0 6px 18px rgba(15,23,42,0.12)"
			}}
			title="Tools"
		>
			Tools
		</button>
	);
}


