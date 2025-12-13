import { useEffect } from "react";
import useAppStore from "../state/store";
import { getMap } from "../state/map";
import MapView from "./MapView";
import BoundaryTools from "./BoundaryTools";
import TrailLayer from "./layers/TrailLayer";
import LayerPresets from "./LayerPresets";
import HuntsLayer from "./layers/HuntsLayer";
import SightingsLayer from "./layers/SightingsLayer";
import AnimalPathsLayer from "./layers/AnimalPathsLayer";
import AnimalSignLayer from "./layers/AnimalSignLayer";
import HarvestsLayer from "./layers/HarvestsLayer";
import AnalyticsToggles from "./AnalyticsToggles";
import SightingsHeatmapLayer from "./analytics/SightingsHeatmapLayer";
import PathDensityLayer from "./analytics/PathDensityLayer";
import ExportButton from "./ExportButton";
import PrintButton from "./PrintButton";
import BasemapLayers from "./basemaps/BasemapLayers";
import BasemapToggles from "./basemaps/BasemapToggles";
import ContoursOverlay from "./basemaps/ContoursOverlay";
import LegendPanel from "./LegendPanel";
import GenericLayer from "./layers/GenericLayer";
import { layerOrder } from "../lib/geo/layerConfig";
import ImportOnXButton from "./ImportOnXButton";
import MyContentButton from "./MyContentButton";
import FeatureDetailsPanel from "./FeatureDetailsPanel";
import FiltersPanel from "./FiltersPanel";
import UserSelector from "./UserSelector";
import ToolsPanel from "./ToolsPanel";
import TerrainControls from "./TerrainControls";
import HistoricalAutoPopulate from "./basemaps/HistoricalAutoPopulate";
import { colors, borderRadius, spacing, typography } from "../lib/theme";

function Landing() {
	const { createNewProject, openExistingProject, loading } = useAppStore();
	return (
		<div
			style={{
				display: "grid",
				placeItems: "center",
				height: "100vh",
				gap: 16,
				fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
			}}
		>
			<h1>True Map</h1>
			<div style={{ display: "flex", gap: 12 }}>
				<button onClick={() => void createNewProject()} disabled={loading}>
					Create New Project
				</button>
				<button onClick={() => void openExistingProject()} disabled={loading}>
					Open Existing Project
				</button>
			</div>
		</div>
	);
}

function PropertyPicker() {
	const { properties, activePropertyId, setActivePropertyId, projectName } = useAppStore();
	if (!properties || properties.length <= 1 || activePropertyId) return null;
	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				background: colors.overlay,
				zIndex: 5000,
				display: "grid",
				placeItems: "center",
				padding: spacing.xxl
			}}
		>
			<div
				style={{
					width: "min(560px, 92vw)",
					background: colors.bgPanelSolid,
					border: `1px solid ${colors.borderMedium}`,
					borderRadius: borderRadius.xl,
					boxShadow: colors.shadowXLarge,
					padding: spacing.xxxl
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div style={{ marginBottom: spacing.xl }}>
					<div style={{ fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
						Select Property
					</div>
					<div style={{ fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs }}>
						{projectName ? `Project: ${projectName}` : "Choose which property to open so we can auto-zoom correctly."}
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
					{properties.map((p) => (
						<button
							key={p.id}
							type="button"
							onClick={() => void setActivePropertyId(p.id)}
							style={{
								padding: `${spacing.lg} ${spacing.xxl}`,
								borderRadius: borderRadius.lg,
								border: `1px solid ${colors.borderMedium}`,
								background: colors.bgButton,
								color: colors.textPrimary,
								fontSize: typography.fontSize.lg,
								fontWeight: typography.fontWeight.semibold,
								cursor: "pointer",
								textAlign: "left",
								transition: "all 0.2s ease"
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background = colors.bgButtonHover;
								e.currentTarget.style.borderColor = colors.primaryBorder;
								e.currentTarget.style.boxShadow = colors.shadowMedium;
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background = colors.bgButton;
								e.currentTarget.style.borderColor = colors.borderMedium;
								e.currentTarget.style.boxShadow = "none";
							}}
						>
							{p.name}
							<div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textMuted, marginTop: spacing.xs }}>
								Auto-zoom + boundary: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{p.boundaryFile}</span>
							</div>
						</button>
					))}
				</div>

				<div style={{ marginTop: spacing.xxl, fontSize: typography.fontSize.sm, color: colors.textMuted }}>
					Tip: we can add more properties later by updating <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>project.json</code>.
				</div>
			</div>
		</div>
	);
}

export default function AppShell() {
	const { projectPath, pendingView, setPendingView } = useAppStore();
	return projectPath ? (
		<>
			<MapView />
			<PropertyPicker />
			<BasemapLayers />
			<HistoricalAutoPopulate />
			<ContoursOverlay />
			<BoundaryTools useExternalToggle />
			{layerOrder
				.filter(
					(id) =>
						id !== "trails" &&
						id !== "hunts" &&
						id !== "animal_sightings" &&
						id !== "animal_paths" &&
						id !== "animal_sign" &&
						id !== "harvests"
				)
				.map((id) => (
					<GenericLayer key={id} layerId={id} />
				))}
			<TrailLayer />
			<HuntsLayer />
			<SightingsLayer />
			<AnimalSignLayer />
			<AnimalPathsLayer />
			<HarvestsLayer />
			<SightingsHeatmapLayer />
			<PathDensityLayer />
			<div
				style={{
					position: "fixed",
					top: 12,
					right: 12,
					display: "flex",
					flexDirection: "column",
					gap: 8,
					alignItems: "stretch",
					zIndex: 1000,
					width: 260
				}}
			>
				<UserSelector />
				<BasemapToggles />
				<TerrainControls />
				<LayerPresets />
				<FiltersPanel />
				<AnalyticsToggles />
			</div>
			<LegendPanel />
			{/* Replaced by ToolsPanel */}
			{/* <PrintButton /> */}
			{/* <ExportButton /> */}
			<ToolsPanel />
			<ImportOnXButton />
			<MyContentButton />
			<FeatureDetailsPanel />
			{pendingView ? (
				<JumpToView target={pendingView} clear={() => setPendingView(null)} />
			) : null}
		</>
	) : (
		<Landing />
	);
}

function JumpToView({
	target,
	clear
}: {
	target: { lon: number; lat: number; zoom?: number };
	clear: () => void;
}) {
	useEffect(() => {
		// Delay to ensure map is fully initialized
		const jumpId = window.setTimeout(() => {
			const map = getMap();
			if (map) {
				window.dispatchEvent(
					new CustomEvent("map:jump-to", {
						detail: target
					})
				);
			}
		}, 100);
		const clearId = window.setTimeout(() => {
			clear();
		}, 2000);
		return () => {
			window.clearTimeout(jumpId);
			window.clearTimeout(clearId);
		};
	}, [target, clear]);
	return null;
}


