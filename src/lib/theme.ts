/**
 * onX-Inspired Design System
 * Warm, premium color palette and design tokens.
 * Values are CSS variables so dark mode can swap palettes without changing light.
 */

export const colors = {
	// Primary Orange (onX-style minimal accent)
	primary: "var(--tm-primary)",
	primaryHover: "var(--tm-primary-hover)",
	primaryActive: "var(--tm-primary-active)",
	primaryLight: "var(--tm-primary-light)",
	primaryBorder: "var(--tm-primary-border)",

	// Backgrounds - Warm Off-White
	bgPrimary: "var(--tm-bg-primary)",
	bgSecondary: "var(--tm-bg-secondary)",
	bgPanel: "var(--tm-bg-panel)",
	bgPanelSolid: "var(--tm-bg-panel-solid)",
	bgButton: "var(--tm-bg-button)",
	bgButtonHover: "var(--tm-bg-button-hover)",

	// Chrome used by older hardcoded white/slate controls (light values stay identical)
	chrome: "var(--tm-chrome)",
	chrome92: "var(--tm-chrome-92)",
	chrome94: "var(--tm-chrome-94)",
	chrome95: "var(--tm-chrome-95)",
	chrome98: "var(--tm-chrome-98)",
	coolFill: "var(--tm-cool-fill)",
	thumbWarm: "var(--tm-thumb-warm)",
	galleryThumb: "var(--tm-gallery-thumb)",
	galleryBtn: "var(--tm-gallery-btn)",
	galleryBorder: "var(--tm-gallery-border)",
	galleryBtnBorder: "var(--tm-gallery-btn-border)",
	galleryEmpty: "var(--tm-gallery-empty)",
	mediaHover: "var(--tm-media-hover)",
	grayBorder: "var(--tm-gray-border)",
	grayMuted: "var(--tm-gray-muted)",
	grayHover: "var(--tm-gray-hover)",
	onGray: "var(--tm-on-gray)",
	green: "var(--tm-green)",

	// Text - Warm Dark Grays
	textPrimary: "var(--tm-text-primary)",
	textSecondary: "var(--tm-text-secondary)",
	textTertiary: "var(--tm-text-tertiary)",
	textMuted: "var(--tm-text-muted)",
	textLight: "var(--tm-text-light)",
	textOnPrimary: "var(--tm-text-on-primary)",
	ink: "var(--tm-ink)",
	inkMuted: "var(--tm-ink-muted)",
	inkLabel: "var(--tm-ink-label)",
	inkSubtle: "var(--tm-ink-subtle)",
	inkFaint: "var(--tm-ink-faint)",

	// Borders - Warm Subtle
	border: "var(--tm-border)",
	borderMedium: "var(--tm-border-medium)",
	borderStrong: "var(--tm-border-strong)",
	borderPrimary: "var(--tm-border-primary)",
	line: "var(--tm-line)",
	line10: "var(--tm-line-10)",
	line20: "var(--tm-line-20)",
	line18: "var(--tm-line-18)",

	// Shadows - Warm Brown Tones
	shadowSubtle: "var(--tm-shadow-subtle)",
	shadowMedium: "var(--tm-shadow-medium)",
	shadowLarge: "var(--tm-shadow-large)",
	shadowXLarge: "var(--tm-shadow-xlarge)",
	shadowGlow: "var(--tm-shadow-glow)",
	shadowChrome: "var(--tm-shadow-chrome)",
	shadowChromeLg: "var(--tm-shadow-chrome-lg)",
	shadowModal: "var(--tm-shadow-modal)",
	shadowBlue: "var(--tm-shadow-blue)",
	shadowDialog: "var(--tm-shadow-dialog)",
	shadowBoundary: "var(--tm-shadow-boundary)",

	// State Colors
	success: "var(--tm-success)",
	error: "var(--tm-error)",
	warning: "var(--tm-warning)",
	info: "var(--tm-info)",
	accentBlue: "var(--tm-accent-blue)",
	dangerBg: "var(--tm-danger-bg)",
	dangerBorder: "var(--tm-danger-border)",
	dangerText: "var(--tm-danger-text)",
	drawActiveBg: "var(--tm-draw-active-bg)",
	drawActiveBorder: "var(--tm-draw-active-border)",

	// Overlay
	overlay: "var(--tm-overlay)"
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
