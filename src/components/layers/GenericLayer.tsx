import { useEffect, useRef, useState } from "react";
import { useMapInstance } from "../../state/map";
import useAppStore from "../../state/store";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Polygon from "ol/geom/Polygon";
import MultiPolygon from "ol/geom/MultiPolygon";
import { Draw, Modify, Select } from "ol/interaction";
import type { LayerId } from "../../lib/geo/schema";
import { layerConfigById } from "../../lib/geo/layerConfig";
import FeatureForm from "../FeatureForm";
import type { GeometryType } from "../../lib/geo/layerConfig";
import type Feature from "ol/Feature";
import { getArea as geodesicArea } from "ol/sphere";
import { useVisibilityStore } from "../../state/visibility";
import { useUserStore } from "../../state/user";
import { shouldShowFeature } from "../../lib/geo/filters";
import { useSelectionStore } from "../../state/selection";

export default function GenericLayer({ layerId }: { layerId: LayerId }) {
	const cfg = layerConfigById[layerId];
	const { projectPath } = useAppStore();
	const map = useMapInstance();
	const sourceRef = useRef<VectorSource>(new VectorSource());
	const layerRef = useRef<VectorLayer<VectorSource> | null>(null);
	const drawRef = useRef<Draw | null>(null);
	const modifyRef = useRef<Modify | null>(null);
	const selectRef = useRef<Select | null>(null);
	const persistRef = useRef<() => Promise<void>>(async () => {});
	const [editing, setEditing] = useState<{ f: Feature; initial?: Record<string, unknown> } | null>(null);

	useEffect(() => {
		if (!map || !projectPath) return;
		const baseStyle = cfg.style;
		const layer = new VectorLayer({
			source: sourceRef.current,
			style: (feat: any) => {
				if (!shouldShowFeature(layerId, feat)) return null as any;
				if (typeof baseStyle === "function") return (baseStyle as any)(feat);
				return baseStyle as any;
			}
		});
		layerRef.current = layer;
		map.addLayer(layer);

		const areaField = cfg.areaField;
		const mapProjection = map.getView().getProjection();
		const ensureArea = (feature: Feature): boolean => {
			if (!areaField) return false;
			const geometry = feature.getGeometry();
			if (!geometry) return false;
			const type = geometry.getType();
			if (type !== "Polygon" && type !== "MultiPolygon") return false;
			const clone =
				type === "Polygon"
					? (geometry.clone() as Polygon)
					: (geometry.clone() as MultiPolygon);
			clone.transform(mapProjection, "EPSG:4326");
			const areaSqM = geodesicArea(clone, { projection: "EPSG:4326" });
			if (!Number.isFinite(areaSqM)) return false;
			const acres = Number((areaSqM / 4046.8564224).toFixed(2));
			const current = feature.get(areaField);
			if (typeof current === "number" && Math.abs(current - acres) < 0.01) {
				return false;
			}
			feature.set(areaField, acres);
			return true;
		};

		const ensurePhotos = (feature: Feature): boolean => {
			let didChange = false;
			const legacyPhoto = feature.get("photo");
			if (legacyPhoto) {
				const arr = Array.isArray(legacyPhoto)
					? legacyPhoto.filter((v: unknown): v is string => typeof v === "string")
					: typeof legacyPhoto === "string"
					? [legacyPhoto]
					: [];
				feature.unset("photo");
				if (arr.length > 0) {
					feature.set("photos", arr);
					didChange = true;
				}
			}
			const photos = feature.get("photos");
			if (photos && !Array.isArray(photos)) {
				if (typeof photos === "string") {
					feature.set("photos", [photos]);
				} else {
					feature.set("photos", []);
				}
				didChange = true;
			}
			return didChange;
		};

		const persist = async () => {
			const gj = new GeoJSON().writeFeaturesObject(sourceRef.current.getFeatures(), {
				dataProjection: "EPSG:4326",
				featureProjection: "EPSG:3857"
			});
			await window.api.writeTextFile(
				projectPath,
				`data/${cfg.file}`,
				JSON.stringify(gj, null, 2)
			);
		};
		persistRef.current = persist;

		const reload = async () => {
			try {
				const text = await window.api.readTextFile(projectPath, `data/${cfg.file}`);
				const geojson = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
				const feats = new GeoJSON().readFeatures(geojson, {
					dataProjection: "EPSG:4326",
					featureProjection: "EPSG:3857"
				});
				sourceRef.current.clear();
				sourceRef.current.addFeatures(feats as any);
				let changed = false;
				(sourceRef.current.getFeatures() as Feature[]).forEach((feat) => {
					if (ensurePhotos(feat)) changed = true;
					if (ensureArea(feat)) changed = true;
				});
				if (changed) {
					await persist();
				}
			} catch (err) {
				const msg = String((err as any)?.message || err || "");
				// If the data file is missing in older projects, seed it with an empty FeatureCollection
				if (msg.includes("ENOENT")) {
					try {
						const emptyFC = JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2);
						await window.api.writeTextFile(projectPath, `data/${cfg.file}`, emptyFC);
						// try loading again after seeding
						const text = await window.api.readTextFile(projectPath, `data/${cfg.file}`);
						const geojson = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
						const feats = new GeoJSON().readFeatures(geojson, {
							dataProjection: "EPSG:4326",
							featureProjection: "EPSG:3857"
						});
						sourceRef.current.clear();
						sourceRef.current.addFeatures(feats as any);
					} catch (seedErr) {
						console.warn(`Failed to seed missing data file for ${layerId}`, seedErr);
					}
				} else {
					console.error(`Failed to load layer ${layerId}`, err);
				}
			}
		};
		void reload();

		// interactions
		if (cfg.selectable !== false) {
			const select = new Select({ layers: [layer] as any });
			selectRef.current = select;
			map.addInteraction(select);
			select.on("select", (e) => {
				const f = (e.selected?.[0] as Feature | undefined) || null;
				useSelectionStore.getState().setSelected(f ? { layerId, feature: f } : null);
			});
		}

		const modify = new Modify({ source: sourceRef.current });
		modifyRef.current = modify;
		map.addInteraction(modify);
		modify.on("modifystart", (evt) => {
			if (evt.mapBrowserEvent.originalEvent.altKey) {
				// Alt-drag mode: scale size/density
				const feature = evt.features.getArray()[0];
				const startCoord = evt.mapBrowserEvent.coordinate;
				// Listen for drag to calculate scale factor
			}
		});
		modify.on("modifyend", (evt) => {
			if (evt.mapBrowserEvent.originalEvent.altKey) {
				// Calculate new size based on drag distance, update property, persist
			}
			const activeUser = useUserStore.getState().activeUser;
			if (!activeUser) {
				window.alert("Please select an Active User before editing geometry.");
				void reload();
				return;
			}
			if (evt.features) {
				evt.features.forEach((feat) => {
					(feat as any).set("updated_by", activeUser);
					(feat as any).set("updated_at", new Date().toISOString());
					if (areaField) {
						ensureArea(feat as Feature);
					}
				});
			}
			void persist();
		});

		const startDraw = () => {
			const activeUser = useUserStore.getState().activeUser;
			if (!activeUser) {
				window.alert("Please select an Active User before adding features.");
				return;
			}
			if (drawRef.current) return;
			const draw = new Draw({ source: sourceRef.current, type: cfg.geometry as GeometryType });
			drawRef.current = draw;
			map.addInteraction(draw);
			draw.on("drawend", (evt) => {
				const f = evt.feature as Feature;
				let initial: Record<string, unknown> | undefined;
				if (ensureArea(f)) {
					initial = { ...(cfg.areaField ? { [cfg.areaField]: f.get(cfg.areaField) } : {}) };
				}
				setEditing({ f, initial });
				if (drawRef.current) {
					map.removeInteraction(drawRef.current);
					drawRef.current = null;
				}
			});
		};
		const deleteSelected = async () => {
			const sel = selectRef.current?.getFeatures?.();
			if (sel) {
				sel.forEach((f) => sourceRef.current.removeFeature(f as any));
				sel.clear();
				await persist();
			}
		};

		const addEvt = `add-feature-${layerId}`;
		const delEvt = `delete-feature-${layerId}`;
		const reloadEvt = `layer:reload:${layerId}`;
		const persistEvt = `layer:persist:${layerId}`;
		const onAdd = () => startDraw();
		const onDel = () => void deleteSelected();
		const onReload = () => void reload();
		const onPersist = () => void persist();
		const onReloadAll = () => void reload();
		window.addEventListener(addEvt, onAdd);
		window.addEventListener(delEvt, onDel);
		window.addEventListener(reloadEvt, onReload);
		window.addEventListener(persistEvt, onPersist);
		window.addEventListener("layers:reload", onReloadAll);

		// Visibility binding - set up subscription after layer is created
		const updateVisibility = () => {
			if (!layerRef.current) return;
			const visible = useVisibilityStore.getState().isLayerVisible(layerId);
			layerRef.current.setVisible(visible);
		};
		
		// Set initial visibility
		updateVisibility();
		
		// Subscribe to store changes
		const unsubVisibility = useVisibilityStore.subscribe(() => {
			updateVisibility();
		});

		return () => {
			window.removeEventListener(addEvt, onAdd);
			window.removeEventListener(delEvt, onDel);
			window.removeEventListener(reloadEvt, onReload);
			window.removeEventListener(persistEvt, onPersist);
			window.removeEventListener("layers:reload", onReloadAll);
			unsubVisibility();
			if (drawRef.current) map.removeInteraction(drawRef.current);
			if (modifyRef.current) map.removeInteraction(modifyRef.current);
			if (selectRef.current) map.removeInteraction(selectRef.current);
			if (layerRef.current) map.removeLayer(layerRef.current);
			drawRef.current = null;
			modifyRef.current = null;
			selectRef.current = null;
			layerRef.current = null;
		};
	}, [map, projectPath, layerId, cfg]);

	const onSubmit = async (values: Record<string, unknown>) => {
		if (!editing) return;
		const activeUser = useUserStore.getState().activeUser;
		if (!activeUser) {
			window.alert("Please select an Active User before saving.");
			return;
		}
		editing.f.setProperties(values);
		if (!editing.f.get("created_by")) editing.f.set("created_by", activeUser);
		if (!editing.f.get("created_at")) editing.f.set("created_at", new Date().toISOString());
		editing.f.set("updated_by", activeUser);
		editing.f.set("updated_at", new Date().toISOString());
		try {
			const activeUser = useUserStore.getState().activeUser;
			if (activeUser) {
				editing.f.set("created_by", activeUser);
			}
		} catch {
			// ignore
		}
		if (cfg.areaField) {
			const mapInstance = map;
			if (mapInstance) {
				const mapProjection = mapInstance.getView().getProjection();
				const geometry = editing.f.getGeometry();
				if (geometry && (geometry.getType() === "Polygon" || geometry.getType() === "MultiPolygon")) {
					const clone =
						geometry.getType() === "Polygon"
							? (geometry.clone() as Polygon)
							: (geometry.clone() as MultiPolygon);
					clone.transform(mapProjection, "EPSG:4326");
					const areaSqM = geodesicArea(clone, { projection: "EPSG:4326" });
					const acres = Number((areaSqM / 4046.8564224).toFixed(2));
					editing.f.set(cfg.areaField, acres);
				}
			}
		}
		setEditing(null);
		await persistRef.current();
	};

	const onCancel = () => {
		if (editing) {
			sourceRef.current.removeFeature(editing.f as any);
			setEditing(null);
		}
	};

	return editing ? (
		<div
			style={{
				position: "fixed",
				left: 0,
				right: 0,
				bottom: 0,
				padding: 12,
				background: "rgba(255,255,255,0.95)",
				borderTop: "1px solid #ddd",
				zIndex: 2000
			}}
		>
			<h3 style={{ marginTop: 0 }}>Add</h3>
			<FeatureForm layerId={layerId} initialValues={editing.initial} onSubmit={onSubmit} onCancel={onCancel} />
		</div>
	) : null;
}


