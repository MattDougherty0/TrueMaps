import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMapInstance } from "../state/map";
import GeoJSON from "ol/format/GeoJSON";
import KML from "ol/format/KML";
import GPX from "ol/format/GPX";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Draw } from "ol/interaction";
import { Fill, Stroke, Style } from "ol/style";
import Feature from "ol/Feature";
import type Polygon from "ol/geom/Polygon";
import MultiPolygon from "ol/geom/MultiPolygon";
import * as turf from "@turf/turf";
import useAppStore from "../state/store";

const boundaryStyle = new Style({
	stroke: new Stroke({ color: "rgba(200, 120, 0, 1)", width: 2 }),
	fill: new Fill({ color: "rgba(200, 120, 0, 0.15)" })
});

export default function BoundaryTools({ useExternalToggle = false }: { useExternalToggle?: boolean } = {}) {
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [drawing, setDrawing] = useState(false);
	const [expanded, setExpanded] = useState(true);
	const sourceRef = useRef<VectorSource>(new VectorSource());
	const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
	const drawRef = useRef<Draw | null>(null);
	const { projectPath, setCrsFromLonLat, hasBoundary, setHasBoundary } = useAppStore();

	const map = useMapInstance();

	useEffect(() => {
		if (useExternalToggle) {
			setExpanded(false);
			return;
		}
		setExpanded(!hasBoundary);
	}, [hasBoundary, useExternalToggle]);

	// External open/close controls
	useEffect(() => {
		if (!useExternalToggle) return;
		const open = () => setExpanded(true);
		const close = () => setExpanded(false);
		window.addEventListener("boundarytools:open", open);
		window.addEventListener("boundarytools:close", close);
		return () => {
			window.removeEventListener("boundarytools:open", open);
			window.removeEventListener("boundarytools:close", close);
		};
	}, [useExternalToggle]);

	const ensureLayer = useCallback(() => {
		if (!map) return;
		if (!layerRef.current) {
			layerRef.current = new VectorLayer({
				source: sourceRef.current,
				style: boundaryStyle
			});
			map.addLayer(layerRef.current);
		}
	}, [map]);

	const importFormats = useMemo(
		() => ({
			".geojson": new GeoJSON(),
			".json": new GeoJSON(),
			".kml": new KML(),
			".gpx": new GPX()
		}),
		[]
	);

	const pickFormat = (name: string) => {
		const lower = name.toLowerCase();
		for (const ext of Object.keys(importFormats)) {
			if (lower.endsWith(ext)) return (importFormats as any)[ext] as GeoJSON | KML | GPX;
		}
		return new GeoJSON();
	};

	const saveBoundary = useCallback(
		async (feature: Feature<Polygon>) => {
			if (!projectPath || !map) return;
			const viewProjection = map.getView().getProjection();
			const gj = new GeoJSON().writeFeatureObject(feature, {
				dataProjection: "EPSG:4326",
				featureProjection: viewProjection
			}) as turf.helpers.Feature<turf.helpers.Polygon>;
			const centroid = turf.centroid(gj).geometry.coordinates as [number, number];
			const areaSqM = turf.area(gj);
			const acres = areaSqM / 4046.8564224;
			(gj.properties ??= {});
			gj.properties.name = "Property";
			gj.properties.acres = Number(acres.toFixed(2));
			gj.properties.notes = "";

			const fc = { type: "FeatureCollection", features: [gj] };
			await window.api.writeTextFile(
				projectPath,
				"data/property_boundary.geojson",
				JSON.stringify(fc, null, 2)
			);
			void setCrsFromLonLat(centroid[0], centroid[1]);
			setHasBoundary(true);
		},
		[projectPath, map, setCrsFromLonLat, setHasBoundary]
	);

	const onImportClick = () => {
		fileInputRef.current?.click();
	};

	const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const inputEl = e.currentTarget;
		const file = inputEl.files?.[0];
		if (!file || !map) return;
		try {
			const format = pickFormat(file.name);
			const text = await file.text();
			const features = (format as any).readFeatures(text, {
				dataProjection: "EPSG:4326",
				featureProjection: map.getView().getProjection()
			}) as Feature[];
			let polygonFeature: Feature<Polygon> | null = null;
			for (const f of features) {
				const geom = f.getGeometry();
				if (!geom) continue;
				const type = geom.getType();
				if (type === "Polygon") {
					polygonFeature = f as Feature<Polygon>;
					break;
				}
				if (type === "MultiPolygon") {
					const multi = geom as MultiPolygon;
					const poly = multi.getPolygon(0);
					if (poly) {
						polygonFeature = new Feature(poly) as Feature<Polygon>;
						break;
					}
				}
			}
			if (!polygonFeature) {
				window.alert("The selected file does not contain a polygon boundary the app can use.");
				return;
			}
			ensureLayer();
			sourceRef.current.clear();
			sourceRef.current.addFeature(polygonFeature);
			if (map) {
				const geometry = polygonFeature.getGeometry();
				if (geometry) {
					map.getView().fit(geometry.getExtent(), {
						padding: [80, 80, 80, 80],
						duration: 500,
						maxZoom: 18
					});
				}
			}
			await saveBoundary(polygonFeature);
			window.dispatchEvent(new CustomEvent("layer:reload:property_boundary"));
		} catch (err) {
			console.error("Failed to import boundary", err);
			window.alert(
				`Import failed: ${
					err instanceof Error ? err.message : "Please make sure the file is a valid KML/GeoJSON polygon."
				}`
			);
		} finally {
			if (inputEl) inputEl.value = "";
		}
	};

	const toggleDraw = () => {
		if (!map) return;
		if (drawing) {
			if (drawRef.current) {
				map.removeInteraction(drawRef.current);
				drawRef.current = null;
			}
			setDrawing(false);
			return;
		}
		ensureLayer();
		const draw = new Draw({
			source: sourceRef.current,
			type: "Polygon"
		});
		draw.on("drawend", async (evt) => {
			const f = evt.feature as Feature<Polygon>;
			// Replace previous geometry, keep only the last drawn
			sourceRef.current.clear();
			sourceRef.current.addFeature(f);
			await saveBoundary(f);
			if (drawRef.current) {
				map.removeInteraction(drawRef.current);
				drawRef.current = null;
				setDrawing(false);
			}
		});
		drawRef.current = draw;
		map.addInteraction(draw);
		setDrawing(true);
	};

	if (!map || !projectPath) return null;

	const baseButtonStyle: CSSProperties = {
		padding: "8px 14px",
		borderRadius: 6,
		border: "1px solid rgba(15,23,42,0.12)",
		background: "#f7f9fc",
		cursor: "pointer",
		fontSize: 13,
		fontWeight: 500,
		textAlign: "left"
	};

	const drawButtonStyle: CSSProperties = drawing
		? { ...baseButtonStyle, background: "#ffe8e6", borderColor: "#fca5a5", color: "#b91c1c" }
		: baseButtonStyle;

	if (!map || !projectPath) return null;

	// When controlled externally, render nothing unless explicitly opened
	if (useExternalToggle && !expanded) {
		return null;
	}

	if (!expanded && hasBoundary && !useExternalToggle) {
		return (
			<>
				<input
					ref={fileInputRef}
					type="file"
					accept=".geojson,.json,.kml,.gpx"
					style={{ display: "none" }}
					onChange={onFileChange}
				/>
				<button
					onClick={() => setExpanded(true)}
					style={{
						position: "fixed",
						top: 12,
						left: 12,
						padding: "6px 12px",
						borderRadius: 6,
						border: "1px solid rgba(15,23,42,0.12)",
						background: "rgba(255,255,255,0.92)",
						fontSize: 12,
						cursor: "pointer",
						color: "rgba(15,23,42,0.75)",
						zIndex: 1000
					}}
				>
					Boundary Tools
				</button>
			</>
		);
	}

	const containerStyle: CSSProperties = useExternalToggle
		? {
				position: "fixed",
				left: "50%",
				top: "50%",
				transform: "translate(-50%, -50%)",
				display: "flex",
				flexDirection: "column",
				gap: 8,
				padding: "14px 16px",
				borderRadius: 10,
				border: "1px solid rgba(15, 23, 42, 0.12)",
				background: "rgba(255, 255, 255, 0.98)",
				boxShadow: "0 22px 48px rgba(15, 23, 42, 0.28)",
				zIndex: 1400,
				minWidth: 280,
				maxWidth: 360
		  }
		: {
				position: "fixed",
				top: 12,
				left: 12,
				display: "flex",
				flexDirection: "column",
				gap: 8,
				padding: "12px 14px",
				borderRadius: 6,
				border: "1px solid rgba(15, 23, 42, 0.12)",
				background: "rgba(255, 255, 255, 0.94)",
				boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12)",
				zIndex: 1000,
				maxWidth: 240
		  };

	return (
		<div style={containerStyle}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<strong style={{ fontSize: 13, color: "rgba(15,23,42,0.75)" }}>Property Boundary</strong>
				{hasBoundary || useExternalToggle ? (
					<button
						onClick={() => setExpanded(false)}
						style={{
							border: "none",
							background: "transparent",
							fontSize: 11,
							color: "rgba(15,23,42,0.55)",
							cursor: "pointer"
						}}
					>
						{useExternalToggle ? "Close" : "Hide"}
					</button>
				) : null}
			</div>
			{hasBoundary ? (
				<p style={{ margin: 0, fontSize: 12, color: "rgba(15,23,42,0.55)" }}>
					Update or replace your existing parcel outline.
				</p>
			) : (
				<p style={{ margin: 0, fontSize: 12, color: "rgba(15,23,42,0.55)" }}>
					Import a boundary file or sketch your property outline.
				</p>
			)}
			<input
				ref={fileInputRef}
				type="file"
				accept=".geojson,.json,.kml,.gpx"
				style={{ display: "none" }}
				onChange={onFileChange}
			/>
			<button
				onClick={onImportClick}
				style={{
					...baseButtonStyle,
					background: "#0a84ff",
					color: "#fff",
					borderColor: "#0a84ff"
				}}
			>
				{hasBoundary ? "Replace Boundary" : "Import Boundary"}
			</button>
			<button onClick={toggleDraw} style={drawButtonStyle}>
				{drawing ? "Cancel Drawing" : hasBoundary ? "Redraw Boundary" : "Draw Boundary"}
			</button>
		</div>
	);
}


