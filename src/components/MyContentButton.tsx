import { useEffect, useState } from "react";
import useAppStore from "../state/store";
import { fileNeedsReview, useMediaStore } from "../state/media";
import TrailCameraMediaManager from "./media/TrailCameraMediaManager";
import { borderRadius, colors, spacing, typography } from "../lib/theme";

export default function MyContentButton() {
	const { projectPath } = useAppStore();
	const files = useMediaStore((state) => state.files);
	const loadFromProject = useMediaStore((state) => state.loadFromProject);
	const [open, setOpen] = useState(false);
	const [initialCameraName, setInitialCameraName] = useState<string | null>(null);
	const [initialCameraSiteId, setInitialCameraSiteId] = useState<string | null>(null);

	useEffect(() => {
		if (!projectPath) return;
		void loadFromProject(projectPath);
	}, [projectPath, loadFromProject]);

	useEffect(() => {
		const onOpenTrailCameraMedia = (event: Event) => {
			const detail = (event as CustomEvent<{ cameraName?: string; cameraSiteId?: string }>).detail;
			setInitialCameraName(detail?.cameraName || null);
			setInitialCameraSiteId(detail?.cameraSiteId || null);
			setOpen(true);
		};
		window.addEventListener("trail-camera-media:open", onOpenTrailCameraMedia);
		return () => window.removeEventListener("trail-camera-media:open", onOpenTrailCameraMedia);
	}, []);

	if (!projectPath) return null;

	const needsReviewCount = files.filter(fileNeedsReview).length;
	const badgeLabel = needsReviewCount > 99 ? "99+" : String(needsReviewCount);

	return (
		<>
			<button
				onClick={() => {
					setInitialCameraName(null);
					setInitialCameraSiteId(null);
					setOpen(true);
				}}
				title={
					needsReviewCount
						? `Trail camera media · ${needsReviewCount} need review`
						: "Trail camera photos, videos, and other media"
				}
				style={{
					position: "fixed",
					top: 12,
					left: 500,
					padding: "8px 14px",
					borderRadius: 6,
					border: `1px solid ${colors.borderMedium}`,
					background: colors.bgPanelSolid,
					cursor: "pointer",
					fontSize: 13,
					fontWeight: 500,
					zIndex: 1000,
					boxShadow: colors.shadowChrome,
					display: "flex",
					alignItems: "center",
					gap: spacing.sm,
					color: colors.textPrimary
				}}
			>
				Media
				{needsReviewCount ? (
					<span
						style={{
							minWidth: 18,
							height: 18,
							padding: `0 ${spacing.sm}`,
							borderRadius: borderRadius.full,
							background: colors.primary,
							color: colors.textOnPrimary,
							fontSize: typography.fontSize.xs,
							fontWeight: typography.fontWeight.bold,
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							lineHeight: 1
						}}
					>
						{badgeLabel}
					</span>
				) : null}
			</button>
			{open ? (
				<TrailCameraMediaManager
					initialCameraName={initialCameraName}
					initialCameraSiteId={initialCameraSiteId}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	);
}
