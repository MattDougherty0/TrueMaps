import { colors, spacing, typography, borderRadius } from "../../lib/theme";
import type { DuplicateWarning } from "../../lib/media/duplicates";

const PREVIEW_LIMIT = 8;

export default function DuplicateWarningList({
	items,
	title,
	compact
}: {
	items: DuplicateWarning[];
	title?: string;
	compact?: boolean;
}) {
	if (!items.length) return null;
	const shown = items.slice(0, PREVIEW_LIMIT);
	const extra = items.length - shown.length;

	return (
		<div
			style={{
				padding: compact ? spacing.md : spacing.lg,
				borderRadius: borderRadius.lg,
				border: `1px solid ${colors.warning}`,
				background: colors.primaryLight,
				display: "grid",
				gap: spacing.sm,
				color: colors.textPrimary
			}}
		>
			<div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold }}>
				{title ||
					`${items.length} duplicate${items.length === 1 ? "" : "s"} already in TrueMap`}
			</div>
			{shown.map((item, index) => (
				<div key={`${item.sourceName}-${item.existingName}-${index}`} style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
					<div>
						<strong style={{ color: colors.textPrimary }}>{item.sourceName}</strong>
						{item.existingName !== item.sourceName ? ` matches ${item.existingName}` : ""}
					</div>
					<div>
						{item.location} · {item.review}
					</div>
				</div>
			))}
			{extra > 0 ? (
				<div style={{ fontSize: typography.fontSize.xs, color: colors.textMuted }}>
					and {extra} more
				</div>
			) : null}
		</div>
	);
}
