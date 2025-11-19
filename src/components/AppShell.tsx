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

export default function AppShell() {
	const { projectPath, pendingView, setPendingView } = useAppStore();
	return projectPath ? (
		<>
			<MapView />
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


