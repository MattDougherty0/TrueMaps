/**
 * onX-Inspired Design System
 * Warm, premium color palette and design tokens
 */

// Color Palette - Warm Earth Tones
export const colors = {
	// Primary Orange (onX-style minimal accent)
	primary: "#FF6B35",
	primaryHover: "#E85A2E",
	primaryActive: "#D44F28",
	primaryLight: "rgba(255, 107, 53, 0.12)",
	primaryBorder: "rgba(255, 107, 53, 0.25)",

	// Backgrounds - Warm Off-White
	bgPrimary: "#FAF9F6",
	bgSecondary: "#F8F7F4",
	bgPanel: "rgba(250, 249, 246, 0.98)",
	bgPanelSolid: "#FEFDFB",
	bgButton: "rgba(248, 247, 244, 0.92)",
	bgButtonHover: "rgba(245, 243, 239, 0.95)",

	// Text - Warm Dark Grays
	textPrimary: "#2D2A24",
	textSecondary: "#6B6658",
	textTertiary: "#7A7568",
	textMuted: "rgba(45, 42, 36, 0.6)",
	textLight: "rgba(45, 42, 36, 0.55)",
	textOnPrimary: "#FFFFFF",

	// Borders - Warm Subtle
	border: "rgba(45, 42, 36, 0.08)",
	borderMedium: "rgba(45, 42, 36, 0.12)",
	borderStrong: "rgba(45, 42, 36, 0.15)",
	borderPrimary: "rgba(255, 107, 53, 0.3)",

	// Shadows - Warm Brown Tones
	shadowSubtle: "0 4px 12px rgba(45, 42, 36, 0.06)",
	shadowMedium: "0 8px 18px rgba(45, 42, 36, 0.08)",
	shadowLarge: "0 12px 28px rgba(45, 42, 36, 0.12)",
	shadowXLarge: "0 16px 40px rgba(45, 42, 36, 0.15)",
	shadowGlow: "0 4px 12px rgba(255, 107, 53, 0.2)",

	// State Colors
	success: "#22C55E",
	error: "#EF4444",
	warning: "#F59E0B",
	info: "#3B82F6",

	// Overlay
	overlay: "rgba(45, 42, 36, 0.4)"
} as const;

// Typography
export const typography = {
	fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
	fontSize: {
		xs: "11px",
		sm: "12px",
		base: "13px",
		md: "14px",
		lg: "16px",
		xl: "18px",
		xxl: "20px"
	},
	fontWeight: {
		normal: 400,
		medium: 500,
		semibold: 600,
		bold: 700
	},
	lineHeight: {
		tight: 1.3,
		normal: 1.5,
		relaxed: 1.6
	},
	letterSpacing: {
		tight: "-0.01em",
		normal: "0",
		wide: "0.8px"
	}
} as const;

// Spacing
export const spacing = {
	xs: "4px",
	sm: "6px",
	md: "8px",
	lg: "12px",
	xl: "14px",
	xxl: "18px",
	xxxl: "24px"
} as const;

// Border Radius
export const borderRadius = {
	sm: "4px",
	md: "6px",
	lg: "8px",
	xl: "10px",
	xxl: "12px",
	full: "999px"
} as const;

// Component Styles
export const components = {
	// Panel
	panel: {
		padding: spacing.lg,
		background: colors.bgPanel,
		border: `1px solid ${colors.borderMedium}`,
		borderRadius: borderRadius.md,
		boxShadow: colors.shadowLarge,
		color: colors.textPrimary
	},

	// Button
	button: {
		base: {
			padding: `${spacing.sm} ${spacing.lg}`,
			borderRadius: borderRadius.md,
			fontSize: typography.fontSize.sm,
			fontWeight: typography.fontWeight.medium,
			cursor: "pointer",
			border: `1px solid ${colors.borderMedium}`,
			transition: "all 0.2s ease"
		},
		primary: {
			background: colors.primary,
			color: colors.textOnPrimary,
			borderColor: colors.primary,
			boxShadow: colors.shadowSubtle
		},
		secondary: {
			background: colors.bgButton,
			color: colors.textPrimary,
			borderColor: colors.borderMedium
		},
		ghost: {
			background: "transparent",
			color: colors.textSecondary,
			border: "none"
		}
	},

	// Input
	input: {
		padding: `${spacing.sm} ${spacing.md}`,
		borderRadius: borderRadius.md,
		border: `1px solid ${colors.border}`,
		background: colors.bgPanelSolid,
		color: colors.textPrimary,
		fontSize: typography.fontSize.sm
	}
} as const;

// Helper function to merge styles
export const mergeStyles = (...styles: Array<React.CSSProperties | undefined>): React.CSSProperties => {
	return Object.assign({}, ...styles.filter(Boolean));
};



