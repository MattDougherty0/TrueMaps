import useAppStore from "../state/store";
import { useState } from "react";
import { printCurrentMap } from "../lib/io/print";

export default function PrintButton() {
	const { projectPath } = useAppStore();
	const [status, setStatus] = useState<string>("");
	const onPrint = async () => {
		if (!projectPath) return;
		setStatus("Printing...");
		try {
			const rel = await printCurrentMap(projectPath);
			setStatus(rel ? `Saved: ${rel.split("/").pop()}` : "Print failed");
		} catch {
			setStatus("Print failed");
		}
		setTimeout(() => setStatus(""), 4000);
	};
	if (!projectPath) return null;
	return (
		<button
			onClick={() => void onPrint()}
			title="Generate a printable PDF map"
			style={{
				position: "fixed",
				top: 12,
				left: 340,
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
			{status || "Print Map"}
		</button>
	);
}


