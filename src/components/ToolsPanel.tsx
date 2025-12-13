import { useState } from "react";
import useAppStore from "../state/store";
import { exportGPX, exportZipOfGeoJSON } from "../lib/io/exports";
import { printCurrentMap } from "../lib/io/print";
import { colors, borderRadius, spacing, typography } from "../lib/theme";

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

	const commonButton: React.CSSProperties = {
		padding: `${spacing.md} ${spacing.lg}`,
		borderRadius: borderRadius.md,
		border: `1px solid ${colors.borderMedium}`,
		background: colors.bgPanelSolid,
		cursor: "pointer",
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		color: colors.textPrimary,
		transition: "all 0.2s ease",
		textAlign: "left" as const
	};

	return open ? (
		<div
			style={{
				position: "fixed",
				right: 16,
				bottom: 16,
				padding: spacing.lg,
				borderRadius: borderRadius.lg,
				border: `1px solid ${colors.borderMedium}`,
				background: colors.bgPanelSolid,
				boxShadow: colors.shadowXLarge,
				zIndex: 1200,
				display: "flex",
				flexDirection: "column",
				gap: spacing.md,
				minWidth: 220
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<strong style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Tools</strong>
				<button
					onClick={() => setOpen(false)}
					style={{ 
						border: "none", 
						background: "transparent", 
						fontSize: typography.fontSize.sm, 
						cursor: "pointer", 
						color: colors.textMuted,
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
			<button
				onClick={() => {
					window.dispatchEvent(new Event("boundarytools:open"));
					setOpen(false);
				}}
				style={commonButton}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = colors.bgButtonHover;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = colors.bgPanelSolid;
				}}
			>
				Boundary Tools
			</button>
			<button 
				onClick={() => void runExport()} 
				style={commonButton}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = colors.bgButtonHover;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = colors.bgPanelSolid;
				}}
			>
				Export
			</button>
			<button 
				onClick={() => void runPrint()} 
				style={commonButton}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = colors.bgButtonHover;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = colors.bgPanelSolid;
				}}
			>
				Print Map
			</button>
			{status ? <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>{status}</div> : null}
		</div>
	) : (
		<button
			onClick={() => setOpen(true)}
			style={{
				position: "fixed",
				right: 16,
				bottom: 16,
				padding: `${spacing.md} ${spacing.xl}`,
				borderRadius: borderRadius.md,
				border: `1px solid ${colors.borderMedium}`,
				background: colors.bgPanelSolid,
				cursor: "pointer",
				fontSize: typography.fontSize.base,
				fontWeight: typography.fontWeight.medium,
				color: colors.textPrimary,
				zIndex: 1200,
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
			title="Tools"
		>
			Tools
		</button>
	);
}


