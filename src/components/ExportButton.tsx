import useAppStore from "../state/store";
import { exportGPX, exportZipOfGeoJSON } from "../lib/io/exports";
import { useState } from "react";

export default function ExportButton() {
	const { projectPath } = useAppStore();
	const [status, setStatus] = useState<string>("");
	const onExport = async () => {
		if (!projectPath) return;
		setStatus("Exporting...");
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
		} catch (e) {
			setStatus("Export failed");
		}
		setTimeout(() => setStatus(""), 3000);
	};
	if (!projectPath) return null;
	const label = status || "Export";
	return (
		<button
			onClick={() => void onExport()}
			title="Zip GeoJSON, GPX, and GeoPackage"
			style={{
				position: "fixed",
				top: 12,
				left: 148,
				padding: "8px 14px",
				borderRadius: 6,
				border: "1px solid rgba(15,23,42,0.12)",
				background: "#ffffff",
				cursor: "pointer",
				fontSize: 13,
				fontWeight: 500,
				zIndex: 1000,
				boxShadow: "0 6px 18px rgba(15,23,42,0.12)"
			}}
		>
			{label}
		</button>
	);
}
