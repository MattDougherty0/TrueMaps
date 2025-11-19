import type { UiSchema } from "@rjsf/utils";
import {
	animalSpecies,
	animalSignTypes,
	timeOfDay,
	terrainUse,
	windRelation,
	ageEstimate,
	mastPresence,
	treeAndShrubSpecies
} from "./catalog";

export type LayerId =
	| "property_boundary"
	| "trees_points"
	| "tree_stands"
	| "bedding_areas"
	| "beds_points"
	| "open_woods"
	| "acorn_flats"
	| "mast_check_points"
	| "big_rocks"
	| "cliffs"
	| "ravines"
	| "streams"
	| "trails"
	| "scrapes"
	| "rubs"
	| "stands"
	| "hunts"
	| "animal_sightings"
	| "animal_paths"
	| "animal_sign"
	| "harvests";

type JsonSchema = Record<string, unknown>;

const dateSchema = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", title: "Date (YYYY-MM-DD)" };
const timeSchema = { type: "string", pattern: "^\\d{2}:\\d{2}$", title: "Time (HH:MM)" };

export const layerSchemas: Record<LayerId, JsonSchema> = {
	property_boundary: {
		type: "object",
		properties: {
			name: { type: "string", title: "Area Name" },
			acres: { type: "number", title: "Acres", readOnly: true },
			notes: { type: "string", title: "Notes" }
		},
		required: ["name", "acres"]
	},
	trees_points: {
		type: "object",
		properties: {
			species_group: { type: "string", enum: ["oak","maple","pine","hemlock","spruce","birch","cherry","beech","ash","aspen","cedar","shrub","other"], title: "Group" },
			species_name: { type: "string", title: "Species" },
			species_other: { type: "string", title: "Other Species" },
			acorn_density_0_5: { type: "integer", minimum: 0, maximum: 5, title: "Acorn Density (0-5)" },
			mast_presence: { type: "string", enum: [...mastPresence], title: "Mast Presence" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		},
		required: ["species_group", "species_name"],
		allOf: [
			{
				if: { properties: { species_group: { const: "oak" } } },
				then: { properties: { species_name: { type: "string", enum: ["red_oak", "white_oak", "chestnut_oak", "black_oak", "scarlet_oak"] } } }
			},
			{
				if: { properties: { species_group: { const: "maple" } } },
				then: { properties: { species_name: { type: "string", enum: ["sugar_maple", "red_maple", "maple"] } } }
			},
			{
				if: { properties: { species_group: { const: "pine" } } },
				then: { properties: { species_name: { type: "string", enum: ["white_pine", "red_pine"] } } }
			},
			{
				if: { properties: { species_group: { const: "hemlock" } } },
				then: { properties: { species_name: { type: "string", enum: ["hemlock"] } } }
			},
			{
				if: { properties: { species_group: { const: "spruce" } } },
				then: { properties: { species_name: { type: "string", enum: ["spruce"] } } }
			},
			{
				if: { properties: { species_group: { const: "birch" } } },
				then: { properties: { species_name: { type: "string", enum: ["birch", "yellow_birch"] } } }
			},
			{
				if: { properties: { species_group: { const: "cherry" } } },
				then: { properties: { species_name: { type: "string", enum: ["cherry"] } } }
			},
			{
				if: { properties: { species_group: { const: "beech" } } },
				then: { properties: { species_name: { type: "string", enum: ["beech"] } } }
			},
			{
				if: { properties: { species_group: { const: "ash" } } },
				then: { properties: { species_name: { type: "string", enum: ["ash"] } } }
			},
			{
				if: { properties: { species_group: { const: "aspen" } } },
				then: { properties: { species_name: { type: "string", enum: ["aspen"] } } }
			},
			{
				if: { properties: { species_group: { const: "cedar" } } },
				then: { properties: { species_name: { type: "string", enum: ["cedar"] } } }
			},
			{
				if: { properties: { species_group: { const: "shrub" } } },
				then: {
					properties: {
						species_name: { type: "string", enum: ["mountain_laurel", "huckleberry", "blueberry"] }
					}
				}
			},
			{
				if: { properties: { species_group: { const: "other" } } },
				then: { properties: { species_name: { type: "string", enum: ["other"] } } }
			}
		]
	},
	tree_stands: {
		type: "object",
		properties: {
			dominant_species: {
				type: "string",
				enum: [
					"red_oak",
					"white_oak",
					"chestnut_oak",
					"hemlock",
					"white_pine",
					"spruce",
					"maple",
					"birch",
					"mixed"
				],
				title: "Dominant Species"
			},
			oak_density_0_5: { type: "integer", minimum: 0, maximum: 5, title: "Oak Density (0-5)" },
			canopy_density_0_5: { type: "integer", minimum: 0, maximum: 5, title: "Canopy Density (0-5)" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" },
			area_acres: { type: "number", title: "Area (acres)", readOnly: true }
		},
		required: []
	},
	bedding_areas: {
		type: "object",
		properties: {
			cover_type: {
				type: "string",
				enum: ["pines", "hemlocks", "laurel", "mountain_laurel", "huckleberry", "blueberry", "brush", "tall_grass", "mixed"],
				title: "Cover Type"
			},
			size_acres: { type: "number", title: "Approximate Size (acres)", readOnly: true },
			freshness: { type: "string", enum: ["fresh", "recent", "old"], title: "Freshness" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		}
	},
	beds_points: {
		type: "object",
		properties: {
			freshness: { type: "string", enum: ["fresh", "recent", "old"], title: "Freshness" },
			hair_present: { type: "boolean", title: "Hair Present" },
			date: dateSchema,
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		}
	},
	open_woods: {
		type: "object",
		properties: {
			openness_1_5: {
				type: "integer",
				minimum: 1,
				maximum: 5,
				title: "Openness (1=Thick, 5=Wide Open)"
			},
			understory_1_5: {
				type: "integer",
				minimum: 1,
				maximum: 5,
				title: "Understory (1=Sparse, 5=Dense)"
			},
			notes: { type: "string", title: "Notes" },
			area_acres: { type: "number", title: "Area (acres)", readOnly: true }
		}
	},
	acorn_flats: {
		type: "object",
		properties: {
			oak_density_0_5: { type: "integer", minimum: 0, maximum: 5, title: "Oak Density (0-5)" },
			acorn_density_0_5: { type: "integer", minimum: 0, maximum: 5, title: "Acorn Density (0-5)" },
			sign_level: { type: "string", enum: ["low", "med", "high"], title: "Deer Sign Level" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" },
			area_acres: { type: "number", title: "Area (acres)", readOnly: true }
		}
	},
	mast_check_points: {
		type: "object",
		properties: {
			oak_species: {
				type: "string",
				enum: ["red", "white", "chestnut", "mixed", "unknown"],
				title: "Oak Species"
			},
			acorn_density_0_5: { type: "integer", minimum: 0, maximum: 5, title: "Acorn Density (0-5)" },
			date: dateSchema,
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		},
		required: ["date"]
	},
	big_rocks: {
		type: "object",
		properties: {
			rock_type: { type: "string", enum: ["boulder", "outcrop", "talus", "other"] },
			size_m: { type: "number", title: "Approximate Size (m)" },
			provides_cover: { type: "boolean", title: "Provides Cover" },
			vantage: { type: "boolean", title: "Good Vantage Point" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		}
	},
	cliffs: {
		type: "object",
		properties: {
			height_est_ft: { type: "integer", title: "Height (ft)" },
			hazard: { type: "boolean", title: "Hazardous" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		}
	},
	ravines: {
		type: "object",
		properties: {
			depth_est_ft: { type: "integer", title: "Depth (ft)" },
			passable: { type: "boolean", title: "Passable on Foot" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		}
	},
	streams: {
		type: "object",
		properties: {
			flow_type: {
				type: "string",
				enum: ["perennial", "intermittent", "ephemeral"],
				title: "Flow Type"
			},
			crossing_easy: { type: "boolean", title: "Easy Crossing" },
			water_depth_cm: { type: "integer", title: "Depth (cm)" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		}
	},
	trails: {
		type: "object",
		properties: {
			name: { type: "string", title: "Trail Name" },
			trail_type: {
				type: "string",
				enum: ["deer", "foot", "atv", "logging_road"],
				enumNames: ["Deer Trail", "Foot Path", "ATV/Access", "Logging Road"],
				title: "Trail Type"
			},
			prominence: {
				type: "string",
				enum: ["main", "faint"],
				enumNames: ["Main Route", "Light/Faint"],
				title: "Traffic Level"
			},
			condition: {
				type: "string",
				enum: ["recent", "old", "rough"],
				enumNames: ["Recent", "Old", "Rough"],
				title: "Condition"
			},
			driveable: { type: "boolean", title: "Driveable" },
			notes: { type: "string", title: "Notes" }
		},
		required: ["name", "trail_type"]
	},
	scrapes: {
		type: "object",
		properties: {
			freshness: { type: "string", enum: ["fresh", "recent", "old"], title: "Freshness" },
			size_class: { type: "string", enum: ["small", "medium", "large"], title: "Size" },
			licking_branch: { type: "boolean", title: "Has Licking Branch" },
			date: dateSchema,
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		},
		required: ["date"]
	},
	rubs: {
		type: "object",
		properties: {
			diameter_in: { type: "number", title: "Trunk Diameter (in)" },
			height_in: { type: "number", title: "Rub Height (in)" },
			direction_bearing: {
				type: "integer",
				minimum: 0,
				maximum: 359,
				title: "Travel Bearing (°)"
			},
			date: dateSchema,
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		},
		required: ["date"]
	},
	stands: {
		type: "object",
		properties: {
			name: { type: "string", title: "Stand Name" },
			stand_type: {
				type: "string",
				enum: ["climber", "double", "blind", "shanty", "saddle", "ground"],
				title: "Stand Type"
			},
			good_winds: {
				type: "array",
				items: {
					type: "string",
					enum: [
						"N",
						"NNE",
						"NE",
						"ENE",
						"E",
						"ESE",
						"SE",
						"SSE",
						"S",
						"SSW",
						"SW",
						"WSW",
						"W",
						"WNW",
						"NW",
						"NNW"
					]
				},
				uniqueItems: true,
				title: "Good Winds"
			},
			access_notes: { type: "string", title: "Access Notes" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		}
	},
	hunts: {
		type: "object",
		properties: {
			hunt_id: { type: "string" },
			user_name: { type: "string" },
			date: dateSchema,
			start_time: timeSchema,
			end_time: timeSchema,
			wind_dir_deg: { type: "integer", minimum: 0, maximum: 359 },
			wind_speed_mph: { type: "number" },
			temp_f: { type: "number" },
			pressure_inhg: { type: "number" },
			stand_or_blind: { type: "string" },
			notes: { type: "string", title: "Notes" }
		},
		required: ["hunt_id", "date", "start_time"]
	},
	animal_sightings: {
		type: "object",
		properties: {
			sighting_id: { type: "string" },
			hunt_id: { type: "string" },
			species: { type: "string", enum: [...animalSpecies] },
			sex: { type: "string", enum: ["unknown", "doe", "buck", "hen", "tom", "boar", "sow"] },
			age_class: { type: "string", enum: ["fawn", "yearling", "2.5+", "unknown"] },
			count: { type: "integer", minimum: 1 },
			behavior: {
				type: "string",
				enum: ["feeding", "moving", "bedding", "alerted", "vocalizing"]
			},
			time_of_day: { type: "string", enum: [...timeOfDay], title: "Time of Day" },
			terrain_use: { type: "string", enum: [...terrainUse], title: "Terrain Use" },
			direction_bearing: { type: "integer", minimum: 0, maximum: 359, title: "Direction (°)" },
			wind_relation: { type: "string", enum: [...windRelation], title: "Wind Relation" },
			distance_yards: { type: "integer" },
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		},
		required: ["sighting_id", "species", "count"]
	},
	animal_paths: {
		type: "object",
		properties: {
			name: { type: "string", title: "Path Name" },
			path_id: { type: "string" },
			hunt_id: { type: "string", title: "Linked Hunt ID" },
			species: { type: "string", enum: [...animalSpecies], title: "Species" },
			confidence: {
				type: "string",
				enum: ["observed", "likely", "guess"],
				enumNames: ["Observed", "Likely", "Assumed"],
				title: "Confidence"
			},
			start_time: timeSchema,
			end_time: timeSchema,
			notes: { type: "string", title: "Notes" }
		},
		required: ["name", "path_id", "species", "confidence"]
	},
	animal_sign: {
		type: "object",
		properties: {
			sign_id: { type: "string" },
			species: { type: "string", enum: [...animalSpecies], title: "Species" },
			sign_type: { type: "string", enum: [...animalSignTypes], title: "Sign Type" },
			freshness: { type: "string", enum: ["fresh", "recent", "old"], title: "Freshness" },
			track_size_class: { type: "string", enum: ["small", "medium", "large"], title: "Track Size (if tracks)" },
			direction_bearing: { type: "integer", minimum: 0, maximum: 359, title: "Direction (°)" },
			scat_size_class: { type: "string", enum: ["pellet", "small", "large"], title: "Scat Size (if scat)" },
			scat_composition: { type: "string", title: "Scat Composition" },
			date: dateSchema,
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" },
			created_by: { type: "string", title: "Created By" }
		},
		required: ["sign_id", "species", "sign_type"]
	},
	harvests: {
		type: "object",
		properties: {
			harvest_id: { type: "string" },
			hunt_id: { type: "string", title: "Linked Hunt ID" },
			species: { type: "string", enum: [...animalSpecies], title: "Species" },
			sex: { type: "string", enum: ["unknown", "doe", "buck", "hen", "tom", "boar", "sow"] },
			weight_lbs: { type: "number", title: "Weight (lbs)" },
			weapon: { type: "string", enum: ["bow", "rifle", "muzzleloader", "shotgun", "other"], title: "Weapon" },
			age_estimate: { type: "string", enum: [...ageEstimate], title: "Age (estimate)" },
			points: { type: "integer", minimum: 0, title: "Points (deer)" },
			beard_length_in: { type: "number", title: "Beard Length (in, turkey)" },
			spur_length_in: { type: "number", title: "Spur Length (in, turkey)" },
			shot_distance_yards: { type: "integer", title: "Shot Distance (yd)" },
			date: dateSchema,
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" },
			created_by: { type: "string", title: "Created By" }
		},
		required: ["harvest_id", "species"]
	},
	cover_points: {
		type: "object",
		properties: {
			cover_type: {
				type: "string",
				enum: ["pines", "hemlocks", "laurel", "mountain_laurel", "huckleberry", "blueberry", "brush", "tall_grass", "mixed"],
				title: "Cover Type"
			},
			date: dateSchema,
			photos: {
				type: "array",
				title: "Photos",
				items: { type: "string" }
			},
			notes: { type: "string", title: "Notes" }
		}
	}
};

export function getLayerSchema(layerId: LayerId): JsonSchema {
	return layerSchemas[layerId] || { type: "object", properties: {} };
}

const layerUiSchemas: Partial<Record<LayerId, UiSchema>> = {
	trees_points: {
		species_group: { "ui:widget": "select" },
		species_name: { "ui:widget": "select", "ui:placeholder": "Choose species" },
		notes: { "ui:widget": "textarea", "ui:options": { rows: 3 } },
		"ui:order": ["species_group", "species_name", "species_other", "acorn_density_0_5", "mast_presence", "photos", "notes"]
	},
	trails: {
		trail_type: {
			"ui:widget": "radio"
		},
		prominence: {
			"ui:widget": "radio"
		},
		notes: {
			"ui:widget": "textarea",
			"ui:options": { rows: 3 },
			"ui:placeholder": "Surface conditions, access notes, landmarks…"
		}
	},
	animal_paths: {
		confidence: {
			"ui:widget": "radio"
		},
		notes: {
			"ui:widget": "textarea",
			"ui:options": { rows: 3 },
			"ui:placeholder": "Observed behavior, timing, direction…"
		}
	},
	stands: {
		good_winds: {
			"ui:widget": "checkboxes"
		},
		notes: {
			"ui:widget": "textarea",
			"ui:options": { rows: 3 },
			"ui:placeholder": "Entry/exit strategy, shooting lanes, nearby cover…"
		},
		photos: {
			"ui:options": { orderable: false }
		}
	}
};

export function getLayerUiSchema(layerId: LayerId): UiSchema | undefined {
	return layerUiSchemas[layerId];
}

