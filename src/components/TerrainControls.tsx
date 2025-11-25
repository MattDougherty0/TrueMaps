import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTerrainPreferences } from "../state/terrain";
import { useCameraPreferences } from "../state/camera";

const containerStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 8,
	padding: 12,
	borderRadius: 10,
	background: "rgba(255,255,255,0.95)",
	border: "1px solid rgba(15,23,42,0.1)",
	boxShadow: "0 8px 18px rgba(15,23,42,0.08)"
};

const badgeStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 600,
	color: "rgba(15,23,42,0.65)",
	textTransform: "uppercase",
	letterSpacing: 0.8
};

const buttonRowStyle: React.CSSProperties = {
	display: "flex",
	gap: 6
};

const modeButtonBase: React.CSSProperties = {
	flex: 1,
	padding: "6px 10px",
	fontSize: 12,
	borderRadius: 6,
	border: "1px solid rgba(15,23,42,0.12)",
	background: "#f8fafc",
	cursor: "pointer",
	fontWeight: 500
};

const modeButtonActive: React.CSSProperties = {
	...modeButtonBase,
	background: "#0f172a",
	color: "#ffffff",
	border: "1px solid rgba(15,23,42,0.4)",
	boxShadow: "0 4px 12px rgba(15,23,42,0.2)"
};

const sliderStyle: React.CSSProperties = {
	width: "100%"
};

const helperTextStyle: React.CSSProperties = {
	fontSize: 11,
	color: "rgba(15,23,42,0.6)",
	lineHeight: 1.3
};

const sliderLabelStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	fontSize: 12,
	color: "rgba(15,23,42,0.75)"
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
               // Ensure projects always open in 2D unless the user explicitly enables 3D.
               setEnabled(false);
           }, [setEnabled]);

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
		padding: "6px 12px",
		borderRadius: 6,
		border: "1px solid rgba(15,23,42,0.12)",
		background: "rgba(255,255,255,0.92)",
		fontSize: 12,
		cursor: "pointer",
		color: "rgba(15,23,42,0.75)",
		boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
		width: "100%",
		textAlign: "left"
	};

	if (!open) {
		return (
			<div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
				<button onClick={() => setOpen(true)} style={toggleButtonStyle}>
					Elevation Mode
				</button>
				<div style={buttonRowStyle}>
					<button
						type="button"
						style={enabled ? modeButtonBase : modeButtonActive}
						onClick={() => setEnabled(false)}
						aria-pressed={!enabled}
					>
						2D
					</button>
					<button
						type="button"
						style={enabled ? modeButtonActive : modeButtonBase}
						onClick={() => setEnabled(true)}
						aria-pressed={enabled}
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
				padding: "12px 14px",
				background: "rgba(255,255,255,0.94)",
				border: "1px solid rgba(15, 23, 42, 0.12)",
				borderRadius: 6,
				boxShadow: "0 12px 28px rgba(15, 23, 42, 0.12)",
				display: "flex",
				flexDirection: "column",
				gap: 8,
				width: "100%"
			}}
		>
			<div
				onClick={() => setOpen(false)}
				style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
				title="Click to collapse"
			>
				<strong style={{ fontSize: 13, color: "rgba(15,23,42,0.75)" }}>Elevation Mode</strong>
				<button
					onClick={() => setOpen(false)}
					style={{
						border: "none",
						background: "transparent",
						fontSize: 12,
						color: "rgba(15,23,42,0.55)",
						cursor: "pointer"
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
				>
					2D
				</button>
				<button
					type="button"
					style={enabled ? modeButtonActive : modeButtonBase}
					onClick={() => setEnabled(true)}
					aria-pressed={enabled}
				>
					3D
				</button>
			</div>
			<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
				<span style={sliderLabelStyle}>
					<span>Elevation exaggeration</span>
					<span>{roundedExaggeration.toFixed(1)}x</span>
				</span>
				<input
					type="range"
					min={0.5}
					max={8}
					step={0.1}
					value={verticalExaggeration}
					onChange={handleExaggerationChange}
					style={sliderStyle}
					disabled={!enabled}
				/>
			</label>
			<div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: enabled ? 1 : 0.55 }}>
				<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
						style={sliderStyle}
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
						style={sliderStyle}
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
						style={sliderStyle}
						disabled={!enabled}
					/>
				</label>
			</div>
			<div style={helperTextStyle}>
				Toggle 3D to tilt the map like onX. Use the slider to exaggerate hills and valleys for easier terrain reading.
			</div>
			{!ionToken && !terrainUrl && !terrariumUrl ? (
				<div style={{ ...helperTextStyle, color: "rgba(220, 38, 38, 0.78)" }}>
					Optional: set `VITE_CESIUM_ION_TOKEN` or `VITE_CESIUM_TERRAIN_URL` to stream high-resolution terrain tiles.
				</div>
			) : null}
			{!ionToken && !terrainUrl && terrariumUrl ? (
				<div style={{ ...helperTextStyle, color: "rgba(34, 197, 94, 0.9)" }}>
					Using global AWS Terrarium elevation tiles for realistic hills without a Cesium Ion token.
				</div>
			) : null}
		</div>
	);
}


