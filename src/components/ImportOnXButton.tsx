import useAppStore from "../state/store";
import { runOnxImportWithDialog } from "../importers/onx";
import { useState } from "react";
import ImportOnXDialog from "./ImportOnXDialog";
import { useUserStore } from "../state/user";

export default function ImportOnXButton() {
	const { projectPath } = useAppStore();
	const activeUser = useUserStore((s) => s.activeUser);
	const [status, setStatus] = useState<string>("");
	const [showDialog, setShowDialog] = useState<boolean>(false);
	const [lastOptions, setLastOptions] = useState<{
		tracksTarget: "trails" | "animal_paths";
		timeZone: string;
		useHeuristics: boolean;
	} | null>(null);
	const [onlyPoints, setOnlyPoints] = useState<boolean>(false);
	const [summary, setSummary] = useState<{
		reportRel: string;
		importedTotal: number;
		layerCount: number;
		duplicates: number;
		unknown: number;
		errors: number;
	} | null>(null);

	const onImport = async () => {
		if (!projectPath) return;
		if (!activeUser) {
			window.alert("Select an Active User before importing onX data.");
			return;
		}
		setStatus("Importing...");
		try {
			const reportRel = await runOnxImportWithDialog(projectPath, {
				tracksTarget: lastOptions?.tracksTarget,
				timeZone: lastOptions?.timeZone,
				useHeuristics: lastOptions?.useHeuristics,
				onlyPoints,
				activeUser
			});
			if (reportRel) {
				try {
					const text = await window.api.readTextFile(projectPath, reportRel);
					const report = JSON.parse(text || "{}") as {
						countsByLayer?: Record<string, number>;
						duplicates?: number;
						unknown?: Array<unknown>;
						errors?: Array<unknown>;
					};
					const counts = report.countsByLayer || {};
					const importedTotal = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
					const layerCount = Object.keys(counts).length;
					setSummary({
						reportRel,
						importedTotal,
						layerCount,
						duplicates: report.duplicates || 0,
						unknown: (report.unknown || []).length,
						errors: (report.errors || []).length
					});
					setStatus("Import complete");
				} catch {
					setStatus("Import complete");
				}
			} else {
				setStatus("Canceled");
			}
		} catch (err) {
			console.error("onX import failed", err);
			setStatus("Import failed");
		}
		setTimeout(() => setStatus(""), 5000);
	};
	if (!projectPath) return null;
	return (
		<>
			<button
				onClick={() => {
					if (!activeUser) {
						window.alert("Select an Active User before importing onX data.");
						return;
					}
					setShowDialog(true);
				}}
				title="Import KML/GPX from onX"
				style={{
					position: "fixed",
					top: 12,
					left: 360,
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
				{status || "Import onX"}
			</button>
			{summary ? (
				<div
					style={{
						position: "fixed",
						top: 52,
						left: 244,
						padding: 12,
						borderRadius: 8,
						border: "1px solid rgba(15,23,42,0.12)",
						background: "#ffffff",
						boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
						zIndex: 1000,
						minWidth: 260
					}}
				>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>Import Summary</div>
					<div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
						<div>Imported: {summary.importedTotal} feature(s) across {summary.layerCount} layer(s)</div>
						<div>Duplicates: {summary.duplicates}</div>
						<div>Unknown: {summary.unknown}</div>
						<div>Errors: {summary.errors}</div>
					</div>
					<div style={{ display: "flex", gap: 8, marginTop: 10 }}>
						<button
							onClick={async () => {
								try {
									const abs = await window.api.resolveMediaPath(projectPath, summary.reportRel);
									if ((window.api as any).openPath) {
										const ok = await (window.api as any).openPath(abs);
										if (!ok) {
											window.alert(abs);
										}
									} else {
										// fallback: show path
										window.alert(abs);
									}
								} catch {
									// ignore
								}
							}}
							style={{
								padding: "6px 10px",
								borderRadius: 6,
								border: "1px solid #0a84ff",
								background: "#0a84ff",
								color: "#ffffff",
								cursor: "pointer",
								fontSize: 12,
								fontWeight: 600
							}}
						>
							Open report
						</button>
						<button
							onClick={() => setSummary(null)}
							style={{
								padding: "6px 10px",
								borderRadius: 6,
								border: "1px solid rgba(15,23,42,0.12)",
								background: "#ffffff",
								cursor: "pointer",
								fontSize: 12
							}}
						>
							Dismiss
						</button>
					</div>
				</div>
			) : null}
			<ImportOnXDialog
				visible={showDialog}
				defaultOnlyPoints={onlyPoints}
				onCancel={() => setShowDialog(false)}
				onConfirm={(opts) => {
					if (!activeUser) {
						window.alert("Select an Active User before importing onX data.");
						return;
					}
					setLastOptions(opts);
					setOnlyPoints(!!opts.onlyPoints);
					setShowDialog(false);
					void onImport();
				}}
			/>
		</>
	);
}


