import { useState } from "react";
import { getColorScheme, toggleColorScheme } from "../state/appearance";
import { borderRadius, colors, spacing, typography } from "../lib/theme";

export default function ThemeToggle() {
	const [scheme, setScheme] = useState(getColorScheme);

	const isDark = scheme === "dark";

	return (
		<button
			type="button"
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			title={isDark ? "Light mode" : "Dark mode"}
			onClick={() => setScheme(toggleColorScheme())}
			style={{
				position: "fixed",
				right: 16,
				bottom: 16,
				zIndex: 5000,
				display: "flex",
				alignItems: "center",
				gap: spacing.sm,
				padding: `${spacing.md} ${spacing.xl}`,
				borderRadius: borderRadius.md,
				border: `1px solid ${colors.borderMedium}`,
				background: colors.bgPanelSolid,
				color: colors.textPrimary,
				cursor: "pointer",
				fontSize: typography.fontSize.base,
				fontWeight: typography.fontWeight.medium,
				boxShadow: colors.shadowMedium,
				transition: "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease"
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.background = colors.bgButtonHover;
				e.currentTarget.style.boxShadow = colors.shadowLarge;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = colors.bgPanelSolid;
				e.currentTarget.style.boxShadow = colors.shadowMedium;
			}}
		>
			<span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
				{isDark ? "☀️" : "🌙"}
			</span>
			{isDark ? "Light" : "Dark"}
		</button>
	);
}
