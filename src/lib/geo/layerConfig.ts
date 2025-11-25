import { Fill, Stroke, Style, Circle as CircleStyle, Text as TextStyle } from "ol/style";
import type { LayerId } from "./schema";
import RegularShape from "ol/style/RegularShape";

export type GeometryType = "Point" | "LineString" | "Polygon";

export type LayerConfig = {
	file: string;
	geometry: GeometryType;
	style: Style | ((feature: any) => Style);
	addable: boolean;
	selectable?: boolean;
	label: string;
	icon?: string;
	legendFill?: string;
	legendStroke?: string;
	legendLine?: string;
	areaField?: string;
};

const line = (color: string, width = 2, dash?: number[]) =>
	new Style({ stroke: new Stroke({ color, width, lineDash: dash }) });
const poly = (fill: string, stroke = "#333", width = 1.5) =>
	new Style({
		fill: new Fill({ color: fill }),
		stroke: new Stroke({ color: stroke, width })
	});

// Update point style helper for vector (no emoji)
const pointVector = (fill: string, stroke = "#fff", radius = 7, shapePoints = 0, rotation = 0) =>
	new Style({
		image: new RegularShape({
			radius,
			points: shapePoints, // e.g., 3 for triangle (tree), 4 for square
			rotation,
			fill: new Fill({ color: fill }),
			stroke: new Stroke({ color: stroke, width: 1.5 }),
		}),
	});

const lineWithLabel =
	(color: string, width: number, prop: string) =>
	(feature: any) => {
		const label = feature?.get?.(prop);
		return new Style({
			stroke: new Stroke({ color, width }),
			text: label
				? new TextStyle({
						text: String(label),
						font: "12px 'Inter', sans-serif",
						fill: new Fill({ color: "#ffffff" }),
						stroke: new Stroke({ color: "rgba(0,0,0,0.6)", width: 3 }),
						placement: "line",
						overflow: true
				  })
				: undefined
		});
	};

// Dynamic styles in config
export const layerConfigById: Record<LayerId, LayerConfig> = {
	property_boundary: {
		file: "property_boundary.geojson",
		geometry: "Polygon",
		style: poly("rgba(56, 189, 248, 0.12)", "rgba(14, 165, 233, 0.9)", 2.2),
		addable: false,
		selectable: false,
		label: "Property Boundary",
		icon: "📐",
		legendFill: "rgba(56, 189, 248, 0.22)",
		legendStroke: "rgba(14, 165, 233, 0.9)",
		areaField: "acres"
	},
	trees_points: {
		file: "trees_points.geojson",
		geometry: "Point",
		style: (feature) => {
			const density = feature.get("density") || "medium";
			const radius = density === "low" ? 5 : density === "high" ? 9 : 7;
			return pointVector("#2e7d32", "#fff", radius, 3); // Triangle for tree
		},
		addable: true,
		label: "Trees",
		icon: "🌲",
		legendFill: "#047857"
	},
	tree_stands: {
		file: "tree_stands.geojson",
		geometry: "Polygon",
		style: poly("rgba(59, 130, 246, 0.20)", "rgba(37, 99, 235, 0.75)", 2),
		addable: true,
		label: "Tree Stand Areas",
		icon: "🏞️",
		legendFill: "rgba(59, 130, 246, 0.30)",
		legendStroke: "rgba(37, 99, 235, 0.75)",
		areaField: "area_acres"
	},
	bedding_areas: {
		file: "bedding_areas.geojson",
		geometry: "Polygon",
		style: poly("rgba(217, 180, 255, 0.26)", "rgba(168, 85, 247, 0.6)", 1.8),
		addable: true,
		label: "Bedding Areas",
		icon: "🛏️",
		legendFill: "rgba(217, 180, 255, 0.38)",
		legendStroke: "rgba(168, 85, 247, 0.6)",
		areaField: "size_acres"
	},
	beds_points: {
		file: "beds_points.geojson",
		geometry: "Point",
		style: pointVector("#7c3aed", "#fff", 7, 4), // Square for "dirt pile"
		addable: true,
		label: "Beds",
		icon: "🛌",
		legendFill: "#7c3aed"
	},
	open_woods: {
		file: "open_woods.geojson",
		geometry: "Polygon",
		style: (feature) => {
			const openness = feature.get("openness_1_5") || 3;
			const understory = feature.get("understory_1_5") || 3;
			const baseOpacity = 0.2 + (5 - openness) * 0.05;
			const hue = 120 - understory * 5; // Greener for dense
			return poly(`hsla(${hue}, 60%, 40%, ${baseOpacity})`, "#4f772d", 1.2);
		},
		addable: true,
		label: "Open Woods",
		icon: "🌳",
		legendFill: "rgba(34, 197, 94, 0.26)",
		legendStroke: "rgba(22, 163, 74, 0.6)",
		areaField: "area_acres"
	},
	cover_points: {
		file: "cover_points.geojson",
		geometry: "Point",
		style: pointVector("#0f766e", "#fff", 7, 4), // Square for "dirt pile"
		addable: true,
		label: "Cover Points",
		icon: "🌿",
		legendFill: "#0f766e"
	},
	acorn_flats: {
		file: "acorn_flats.geojson",
		geometry: "Polygon",
		style: poly("rgba(250, 204, 21, 0.24)", "rgba(217, 119, 6, 0.6)", 1.6),
		addable: true,
		label: "Acorn Flats",
		icon: "🌰",
		legendFill: "rgba(250, 204, 21, 0.36)",
		legendStroke: "rgba(217, 119, 6, 0.6)",
		areaField: "area_acres"
	},
	mast_check_points: {
		file: "mast_check_points.geojson",
		geometry: "Point",
		style: pointVector("#ca8a04", "#fff", 7, 4), // Square for "dirt pile"
		addable: true,
		label: "Mast Checkpoints",
		icon: "🔍",
		legendFill: "#ca8a04"
	},
	big_rocks: {
		file: "big_rocks.geojson",
		geometry: "Point",
		style: (feature) => {
			const size_m = feature.get("size_m") || 5;
			const density = feature.get("density") || "medium";
			const radius = Math.min(12, size_m);
			const points = density === "high" ? 8 : 4; // More points = "cluster" look
			return pointVector("#616161", "#fff", radius, points);
		},
		addable: true,
		label: "Big Rocks",
		icon: "🪨",
		legendFill: "#4b5563"
	},
	cliffs: {
		file: "cliffs.geojson",
		geometry: "LineString",
		style: line("#a16207", 3.2, [6, 4]),
		addable: true,
		label: "Cliffs",
		icon: "📉",
		legendLine: "#a16207"
	},
	ravines: {
		file: "ravines.geojson",
		geometry: "LineString",
		style: line("#7c3aed", 3, [4, 4]),
		addable: true,
		label: "Ravines",
		icon: "🏔️",
		legendLine: "#7c3aed"
	},
	streams: {
		file: "streams.geojson",
		geometry: "LineString",
		style: line("#0ea5e9", 3.2),
		addable: true,
		label: "Streams",
		icon: "💧",
		legendLine: "#0ea5e9"
	},
	trails: {
		file: "trails.geojson",
		geometry: "LineString",
		style: lineWithLabel("#f97316", 3.2, "name"),
		addable: true,
		label: "Trails",
		icon: "🛤️",
		legendLine: "#f97316"
	},
	scrapes: {
		file: "scrapes.geojson",
		geometry: "Point",
		style: pointVector("#ff7043", "#fff", 7, 4), // Square for "dirt pile"
		addable: true,
		label: "Scrapes",
		icon: "👣",
		legendFill: "#f97316"
	},
	rubs: {
		file: "rubs.geojson",
		geometry: "Point",
		style: pointVector("#a0522d", "#fff", 7, 5), // Pentagon for "rub mark"
		addable: true,
		label: "Rubs",
		icon: "🪵",
		legendFill: "#dc2626"
	},
	stands: {
		file: "stands.geojson",
		geometry: "Point",
		style: pointVector("#1d4ed8", "#fff", 9, 5), // Pentagon for "tree stand"
		addable: true,
		label: "Tree Stand Points",
		icon: "🪜",
		legendFill: "#1d4ed8"
	},
	hunts: {
		file: "hunts.geojson",
		geometry: "Point",
		style: pointVector("#0ea5e9", "#fff", 8, 4), // Square for "hunt"
		addable: true,
		label: "Hunts",
		icon: "🎯",
		legendFill: "#0ea5e9"
	},
	animal_sightings: {
		file: "animal_sightings.geojson",
		geometry: "Point",
		style: pointVector("#ec4899", "#fff", 8, 4), // Square for "sighting"
		addable: true,
		label: "Animal Sightings",
		icon: "👁️",
		legendFill: "#ec4899"
	},
	animal_paths: {
		file: "animal_paths.geojson",
		geometry: "LineString",
		style: lineWithLabel("#14b8a6", 3.2, "name"),
		addable: true,
		label: "Animal Paths",
		icon: "🦶",
		legendLine: "#14b8a6"
	},
	animal_sign: {
		file: "animal_sign.geojson",
		geometry: "Point",
		style: pointVector("#9333ea", "#fff", 7, 4), // Square for "sign"
		addable: true,
		label: "Animal Sign",
		icon: "🐾",
		legendFill: "#9333ea"
	},
	harvests: {
		file: "harvests.geojson",
		geometry: "Point",
		style: pointVector("#f43f5e", "#fff", 8, 4), // Square for "harvest"
		addable: true,
		label: "Harvests",
		icon: "🏆",
		legendFill: "#f43f5e"
	}
};

export const layerOrder: LayerId[] = [
	"property_boundary",
	"streams",
	"cliffs",
	"ravines",
	"trails",
	"tree_stands",
	"open_woods",
	"cover_points",
	"acorn_flats",
	"bedding_areas",
	"trees_points",
	"beds_points",
	"mast_check_points",
	"big_rocks",
	"scrapes",
	"rubs",
	"stands",
	"animal_sign",
	"animal_paths",
	"hunts",
	"harvests",
	"animal_sightings"
];


