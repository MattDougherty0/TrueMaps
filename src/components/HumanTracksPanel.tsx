import { useTrackVisibilityStore } from "../state/trackVisibility";
import { borderRadius, colors, spacing, typography } from "../lib/theme";

export default function HumanTracksPanel() {
	const tracks = useTrackVisibilityStore((s) => s.tracks);
	const setTrackVisible = useTrackVisibilityStore((s) => s.setTrackVisible);
	const setAllTracksVisible = useTrackVisibilityStore((s) => s.setAllTracksVisible);
	const allTracksVisible = tracks.length > 0 && tracks.every((track) => track.visible);
	const someTracksVisible = tracks.some((track) => track.visible);

	return (
		<div
			style={{
				padding: `${spacing.lg} ${spacing.xl}`,
				borderRadius: borderRadius.md,
				border: `1px solid ${colors.borderMedium}`,
				background: colors.bgPanel,
				boxShadow: colors.shadowLarge,
				width: "100%",
				fontSize: typography.fontSize.sm,
				color: colors.textPrimary
			}}
		>
			<label
				style={{
					display: "flex",
					alignItems: "center",
					gap: spacing.sm,
					cursor: tracks.length ? "pointer" : "default",
					fontWeight: typography.fontWeight.semibold
				}}
			>
				<input
					type="checkbox"
					checked={allTracksVisible}
					disabled={!tracks.length}
					ref={(el) => {
						if (el) el.indeterminate = someTracksVisible && !allTracksVisible;
					}}
					onChange={(event) => setAllTracksVisible(event.target.checked)}
					style={{ accentColor: colors.primary, cursor: tracks.length ? "pointer" : "default" }}
				/>
				<span>🚶</span>
				<span>Human Tracks{tracks.length ? ` (${tracks.length})` : ""}</span>
			</label>
			{tracks.length ? (
				<div
					style={{
						marginTop: spacing.md,
						display: "flex",
						flexDirection: "column",
						gap: spacing.xs,
						maxHeight: 180,
						overflowY: "auto"
					}}
				>
					{tracks.map((track) => (
						<label
							key={track.id}
							style={{
								display: "flex",
								alignItems: "center",
								gap: spacing.sm,
								cursor: "pointer",
								fontWeight: typography.fontWeight.medium
							}}
						>
							<input
								type="checkbox"
								checked={track.visible}
								onChange={(event) => setTrackVisible(track.id, event.target.checked)}
								style={{ accentColor: colors.primary, cursor: "pointer" }}
							/>
							<span
								title={track.name}
								style={{
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap"
								}}
							>
								{track.name}
							</span>
						</label>
					))}
				</div>
			) : (
				<div style={{ marginTop: spacing.sm, fontSize: typography.fontSize.xs, color: colors.textMuted }}>
					No tracks loaded
				</div>
			)}
		</div>
	);
}
