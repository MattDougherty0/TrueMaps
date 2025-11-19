import { useState } from "react";
import useAppStore from "../state/store";
import MediaLibrary from "./media/MediaLibrary";

export default function MyContentButton() {
	const { projectPath } = useAppStore();
	const [open, setOpen] = useState(false);

	if (!projectPath) return null;

	return (
		<>
			<button
				onClick={() => setOpen(true)}
				title="My Content - Photos & Videos"
				style={{
					position: "fixed",
					top: 12,
					left: 500,
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
				My Content
			</button>
			{open && <MediaLibrary onClose={() => setOpen(false)} />}
		</>
	);
}



