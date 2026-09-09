import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTerrainPreferences } from "../state/terrain";
import { useCameraPreferences } from "../state/camera";
import { colors, borderRadius, spacing, typography } from "../lib/theme";

const buttonRowStyle: React.CSSProperties = {
	display: "flex",
		gap: spacing.sm
	};

	// Define slider and helper styles using theme
const sliderStyle: React.CSSProperties = {
		width: "100%",
		accentColor: colors.primary
};

const sliderLabelStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
		fontSize: typography.fontSize.sm,
		color: colors.textPrimary,
		fontWeight: typography.fontWeight.medium
	};

	const helperTextStyle: React.CSSProperties = {
		fontSize: typography.fontSize.xs,
		color: colors.textMuted,
		lineHeight: typography.lineHeight.normal
};

export default function TerrainControls() {
	const [open, setOpen] = useState(false);
           const {
               enabled,
               verticalExaggeration,
               setEnabled,
               setVerticalExaggeration,
               ionToken,
               terrainUrl,
               terrariumUrl
           } = useTerrainPreferences((state) => ({
               enabled: state.enabled,
               verticalExaggeration: state.verticalExaggeration,
               setEnabled: state.setEnabled,
               setVerticalExaggeration: state.setVerticalExaggeration,
               ionToken: state.ionToken,
               terrainUrl: state.terrainUrl,
               terrariumUrl: state.terrariumUrl
           }));

	useEffect(() => {
		// Cleanup timeout on unmount
		return () => {
			if (cameraUpdateTimeoutRef.current !== null) {
				clearTimeout(cameraUpdateTimeoutRef.current);
				cameraUpdateTimeoutRef.current = null;
			}
		};
	}, []);

	const { heading, pitch, height, setHeading, setPitch, setHeight } = useCameraPreferences((state) => ({
		heading: state.heading,
		pitch: state.pitch,
		height: state.height,
		setHeading: state.setHeading,
		setPitch: state.setPitch,
		setHeight: state.setHeight
	}));
	const {
		terrainSource,
		sceneMode3D,
		terrainAssetId,
		setTerrainSource,
		setSceneMode3D
	} = useTerrainPreferences((state) => ({
		terrainSource: state.terrainSource,
		sceneMode3D: state.sceneMode3D,
		terrainAssetId: state.terrainAssetId,
		setTerrainSource: state.setTerrainSource,
		setSceneMode3D: state.setSceneMode3D
	}));

	const roundedExaggeration = useMemo(
		() => Math.round(verticalExaggeration * 10) / 10,
		[verticalExaggeration]
	);

	const handleExaggerationChange = (event: ChangeEvent<HTMLInputElement>) => {
		const value = Number.parseFloat(event.target.value);
		if (Number.isFinite(value)) {
			setVerticalExaggeration(value);
			// No camera event needed - vertical exaggeration is handled by terrain subscription
		}
	};

	const cameraUpdateTimeoutRef = useRef<number | null>(null);

	const emitCameraChange = (partial: { heading?: number; pitch?: number; height?: number }, animate = false) => {
		// Clear any pending update
		if (cameraUpdateTimeoutRef.current !== null) {
			clearTimeout(cameraUpdateTimeoutRef.current);
		}
		// For slider dragging, use immediate non-animated updates
		// Debounce slightly to avoid excessive events
		cameraUpdateTimeoutRef.current = window.setTimeout(() => {
			window.dispatchEvent(
				new CustomEvent("map:set-camera-pose", {
					detail: { ...partial, animate }
				})
			);
			cameraUpdateTimeoutRef.current = null;
		}, animate ? 0 : 16); // ~60fps for non-animated, immediate for animated
	};

	const toggleButtonStyle: React.CSSProperties = {
		padding: `${spacing.sm} ${spacing.lg}`,
		borderRadius: borderRadius.md,
		border: `1px solid ${colors.borderMedium}`,
		background: colors.bgButton,
		fontSize: typography.fontSize.sm,
		fontWeight: typography.fontWeight.medium,
		cursor: "pointer",
		color: colors.textPrimary,
		boxShadow: colors.shadowSubtle,
		width: "100%",
		textAlign: "left",
		transition: "all 0.2s ease"
	};

	const modeButtonBase: React.CSSProperties = {
		flex: 1,
		padding: `${spacing.sm} ${spacing.lg}`,
		fontSize: typography.fontSize.sm,
		borderRadius: borderRadius.md,
		border: `1px solid ${colors.borderMedium}`,
		background: colors.bgButton,
		cursor: "pointer",
		fontWeight: typography.fontWeight.medium,
		color: colors.textPrimary,
		transition: "all 0.2s ease"
	};

	const modeButtonActive: React.CSSProperties = {
		...modeButtonBase,
		background: colors.primary,
		color: colors.textOnPrimary,
		border: `1px solid ${colors.primary}`,
		boxShadow: colors.shadowGlow
	};

	if (!open) {
		return (
			<div style={{ display: "flex", flexDirection: "column", gap: spacing.md, width: "100%" }}>
				<button 
					onClick={() => setOpen(true)} 
					style={toggleButtonStyle}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = colors.bgButtonHover;
						e.currentTarget.style.boxShadow = colors.shadowMedium;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = colors.bgButton;
						e.currentTarget.style.boxShadow = colors.shadowSubtle;
					}}
				>
					Elevation Mode
				</button>
				<div style={buttonRowStyle}>
					<button
						type="button"
						style={enabled ? modeButtonBase : modeButtonActive}
						onClick={() => setEnabled(false)}
						aria-pressed={!enabled}
						onMouseEnter={(e) => {
							if (!enabled) return;
							e.currentTarget.style.background = colors.bgButtonHover;
						}}
						onMouseLeave={(e) => {
							if (!enabled) return;
							e.currentTarget.style.background = colors.bgButton;
						}}
					>
						2D
					</button>
					<button
						type="button"
						style={enabled ? modeButtonActive : modeButtonBase}
						onClick={() => setEnabled(true)}
						aria-pressed={enabled}
						onMouseEnter={(e) => {
							if (enabled) {
								e.currentTarget.style.background = colors.primaryHover;
							} else {
								e.currentTarget.style.background = colors.bgButtonHover;
							}
						}}
						onMouseLeave={(e) => {
							if (enabled) {
								e.currentTarget.style.background = colors.primary;
							} else {
								e.currentTarget.style.background = colors.bgButton;
							}
						}}
					>
						3D
					</button>
				</div>
			</div>
		);
	}

	return (
		<div
			style={{
				padding: `${spacing.lg} ${spacing.xl}`,
				background: colors.bgPanel,
				border: `1px solid ${colors.borderMedium}`,
				borderRadius: borderRadius.md,
				boxShadow: colors.shadowLarge,
				display: "flex",
				flexDirection: "column",
				gap: spacing.md,
				width: "100%"
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<strong style={{ fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Elevation Mode</strong>
				<button
					onClick={() => setOpen(false)}
					style={{
						border: "none",
						background: "transparent",
						fontSize: typography.fontSize.sm,
						color: colors.textMuted,
						cursor: "pointer",
						padding: spacing.xs,
						borderRadius: borderRadius.sm,
						transition: "all 0.2s ease"
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.color = colors.textSecondary;
						e.currentTarget.style.background = colors.bgButton;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.color = colors.textMuted;
						e.currentTarget.style.background = "transparent";
					}}
				>
					Hide
				</button>
			</div>
			<div style={buttonRowStyle}>
				<button
					type="button"
					style={enabled ? modeButtonBase : modeButtonActive}
					onClick={() => setEnabled(false)}
					aria-pressed={!enabled}
					onMouseEnter={(e) => {
						if (!enabled) return;
						e.currentTarget.style.background = colors.bgButtonHover;
					}}
					onMouseLeave={(e) => {
						if (!enabled) return;
						e.currentTarget.style.background = colors.bgButton;
					}}
				>
					2D
				</button>
				<button
					type="button"
					style={enabled ? modeButtonActive : modeButtonBase}
					onClick={() => setEnabled(true)}
					aria-pressed={enabled}
					onMouseEnter={(e) => {
						if (enabled) {
							e.currentTarget.style.background = colors.primaryHover;
						} else {
							e.currentTarget.style.background = colors.bgButtonHover;
						}
					}}
					onMouseLeave={(e) => {
						if (enabled) {
							e.currentTarget.style.background = colors.primary;
						} else {
							e.currentTarget.style.background = colors.bgButton;
						}
					}}
				>
					3D
				</button>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, opacity: enabled ? 1 : 0.55 }}>
				<span style={sliderLabelStyle}>
					<span>3D ground</span>
				</span>
				<div style={buttonRowStyle}>
					<button
						type="button"
						style={sceneMode3D === "surface" ? modeButtonActive : modeButtonBase}
						onClick={() => setSceneMode3D("surface")}
						disabled={!enabled}
					>
						Satellite
					</button>
					<button
						type="button"
						style={sceneMode3D === "mesh" ? modeButtonActive : modeButtonBase}
						onClick={() => setSceneMode3D("mesh")}
						disabled={!enabled || !ionToken}
						title={ionToken ? "Google Photorealistic 3D tiles (trees and buildings where coverage exists)" : "Requires a Cesium Ion token"}
					>
						3D mesh
					</button>
				</div>
			</div>
			{terrainAssetId ? (
				<div style={{ display: "flex", flexDirection: "column", gap: spacing.sm, opacity: enabled ? 1 : 0.55 }}>
					<span style={sliderLabelStyle}>
						<span>Elevation data</span>
					</span>
					<div style={buttonRowStyle}>
						<button
							type="button"
							style={terrainSource === "world" ? modeButtonActive : modeButtonBase}
							onClick={() => setTerrainSource("world")}
							disabled={!enabled}
							title="Cesium World Terrain from USGS 3DEP. Best for McKean and anywhere the local DEM does not cover."
						>
							World
						</button>
						<button
							type="button"
							style={terrainSource === "local" ? modeButtonActive : modeButtonBase}
							onClick={() => setTerrainSource("local")}
							disabled={!enabled || !ionToken}
							title="Your uploaded Ion DEM (Camp / Newport). Use this on that property only."
						>
							Local DEM
						</button>
					</div>
				</div>
			) : null}
			<label style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
				<span style={sliderLabelStyle}>
					<span>Elevation exaggeration</span>
					<span>{roundedExaggeration.toFixed(1)}x</span>
				</span>
				<input
					type="range"
					min={0.8}
					max={4}
					step={0.1}
					value={verticalExaggeration}
					onChange={handleExaggerationChange}
					style={{ width: "100%", accentColor: colors.primary }}
					disabled={!enabled}
				/>
			</label>
			<div style={{ display: "flex", flexDirection: "column", gap: spacing.md, opacity: enabled ? 1 : 0.55 }}>
				<label style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
					<span style={sliderLabelStyle}>
						<span>Heading</span>
						<span>{heading.toFixed(0)}°</span>
					</span>
					<input
						type="range"
						min={0}
						max={360}
						step={1}
						value={heading}
						onChange={(event) => {
							const value = Number.parseFloat(event.target.value);
							if (Number.isFinite(value)) {
								setHeading(value);
								emitCameraChange({ heading: value }, false);
							}
						}}
						style={{ width: "100%", accentColor: colors.primary }}
						disabled={!enabled}
					/>
				</label>
				<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
					<span style={sliderLabelStyle}>
						<span>Pitch / tilt</span>
						<span>{pitch.toFixed(0)}°</span>
					</span>
					<input
						type="range"
						min={5}
						max={85}
						step={1}
						value={pitch}
						onChange={(event) => {
							const value = Number.parseFloat(event.target.value);
							if (Number.isFinite(value)) {
								setPitch(value);
								emitCameraChange({ pitch: value }, false);
							}
						}}
						style={{ width: "100%", accentColor: colors.primary }}
						disabled={!enabled}
					/>
				</label>
				<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
					<span style={sliderLabelStyle}>
						<span>Camera height</span>
						<span>{Math.round(height)} m</span>
					</span>
					<input
						type="range"
						min={80}
						max={5000}
						step={20}
						value={height}
						onChange={(event) => {
							const value = Number.parseFloat(event.target.value);
							if (Number.isFinite(value)) {
								setHeight(value);
								emitCameraChange({ height: value }, false);
							}
						}}
						style={{ width: "100%", accentColor: colors.primary }}
						disabled={!enabled}
					/>
				</label>
			</div>
			<div style={helperTextStyle}>
				3D uses current satellite on USGS 3DEP terrain, with afternoon lighting so ridges read. Historical stays 2D. Hillshade is 2D-only; turn on Topo / creeks if you want linework on the photos.
			</div>
			{ionToken ? (
				<div style={{ ...helperTextStyle, color: colors.success }}>
					{terrainSource === "local"
						? "Using your local Ion DEM. Switch to World if the land looks flat or clipped."
						: sceneMode3D === "mesh"
							? "Photorealistic mesh is on. Woods coverage varies; switch back to Satellite if trees hide the ground."
							: "Using Cesium World Terrain and current satellite imagery."}
				</div>
			) : null}
			{!ionToken && !terrainUrl && terrariumUrl ? (
				<div style={{ ...helperTextStyle, color: colors.error }}>
					No Cesium Ion token — 3D is falling back to ~30 m Terrarium tiles. Set VITE_CESIUM_ION_TOKEN for real terrain.
				</div>
			) : null}
		</div>
	);
}


