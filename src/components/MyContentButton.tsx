import { useEffect, useState } from "react";
import useAppStore from "../state/store";
import MediaLibrary from "./media/MediaLibrary";
import TrailCameraMediaManager from "./media/TrailCameraMediaManager";

export default function MyContentButton() {
	const { projectPath } = useAppStore();
	const [open, setOpen] = useState<"trail-cameras" | "content" | null>(null);
	const [initialCameraName, setInitialCameraName] = useState<string | null>(null);
	const [initialCameraSiteId, setInitialCameraSiteId] = useState<string | null>(null);

	useEffect(() => {
		const onOpenTrailCameraMedia = (event: Event) => {
			const detail = (event as CustomEvent<{ cameraName?: string; cameraSiteId?: string }>).detail;
			setInitialCameraName(detail?.cameraName || null);
			setInitialCameraSiteId(detail?.cameraSiteId || null);
			setOpen("trail-cameras");
		};
		window.addEventListener("trail-camera-media:open", onOpenTrailCameraMedia);
		return () => window.removeEventListener("trail-camera-media:open", onOpenTrailCameraMedia);
	}, []);

	if (!projectPath) return null;

	return (
		<>
			<button
				onClick={() => {
					setInitialCameraName(null);
					setInitialCameraSiteId(null);
					setOpen("trail-cameras");
				}}
				title="Trail camera photos, videos, and other media"
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
				Media
			</button>
			{open === "trail-cameras" ? (
				<TrailCameraMediaManager
					initialCameraName={initialCameraName}
					initialCameraSiteId={initialCameraSiteId}
					onClose={() => setOpen(null)}
					onOpenContent={() => setOpen("content")}
				/>
			) : null}
			{open === "content" ? <MediaLibrary onClose={() => setOpen(null)} /> : null}
		</>
	);
}



