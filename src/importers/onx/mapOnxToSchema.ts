import type { ImportOptions, MappedFeature, ParsedFeature } from "./types";

export function mapOnxToSchema(parsed: ParsedFeature, opts: ImportOptions): MappedFeature | null {
	const name = (parsed.name || "").toLowerCase().trim();
	const [prefixRaw, ...rest] = name.split(":");
	const prefix = prefixRaw?.trim() || "";
	const tail = rest.join(":").trim();
	const notes = parsed.desc || "";
	const geomType = parsed.geometry.type;
	const iconHint = String((parsed.props as any)?.icon || "").toLowerCase().trim();
	const colorHint = String((parsed.props as any)?.color || "").trim();

	const withProps = (layerId: string, props: Record<string, unknown>) => ({
		type: "Feature",
		geometry: parsed.geometry,
		properties: { ...props, notes }
	}) as GeoJSON.Feature;

	const asNumber = (text: string): number | undefined => {
		const m = text.match(/(\d+(\.\d+)?)/);
		return m ? Number(m[1]) : undefined;
	};

	const features: Record<string, GeoJSON.Feature | null> = {
		stands: withProps("stands", {
			stand_type: tail.includes("climber")
				? "climber"
				: tail.includes("shanty")
				? "shanty"
				: tail.includes("blind")
				? "blind"
				: tail.includes("saddle")
				? "saddle"
				: undefined
		}),
		tree_stands:
			geomType === "Polygon"
				? withProps("tree_stands", {
						stand_type: tail.includes("climber")
							? "climber"
							: tail.includes("shanty")
							? "shanty"
							: tail.includes("blind")
							? "blind"
							: tail.includes("saddle")
							? "saddle"
							: undefined
				  })
				: null,
		scrapes: withProps("scrapes", {
			freshness: tail.includes("fresh") ? "fresh" : tail.includes("recent") ? "recent" : undefined
		}),
		rubs: withProps("rubs", {
			diameter_in: asNumber(tail)
		}),
		trees_points: withProps("trees_points", {
			species: tail.replace(/\s+/g, "_")
		}),
		trails:
			geomType === "LineString"
				? withProps("trails", {
						trail_type: tail.includes("atv") ? "atv" : tail.includes("deer") ? "deer" : "foot",
						prominence: tail.includes("faint") ? "faint" : "main"
				  })
				: null,
		thick_bedding:
			geomType === "Polygon"
				? withProps("thick_bedding", {
						cover_type: tail.includes("hemlock") ? "hemlocks" : undefined,
						thickness: 3
				  })
				: null,
		beds_points: withProps("beds_points", {}),
		acorn_flats:
			geomType === "Polygon"
				? withProps("acorn_flats", {
						acorn_density_0_5: asNumber(tail)
				  })
				: null,
		open_woods:
			geomType === "Polygon"
				? withProps("open_woods", {
						openness_1_5: asNumber(tail)
				  })
				: null,
		big_rocks: withProps("big_rocks", {
			rock_type: tail.includes("boulder") ? "boulder" : undefined
		}),
		cliffs: geomType === "LineString" ? withProps("cliffs", {}) : null,
		ravines: geomType === "LineString" ? withProps("ravines", {}) : null,
		streams: geomType === "LineString" ? withProps("streams", {}) : null,
		hunts: withProps("hunts", {}),
		animal_sightings: withProps("animal_sightings", {}),
		animal_paths:
			geomType === "LineString"
				? withProps("animal_paths", {
						confidence: "observed"
				  })
				: null
		,
		waypoints: withProps("waypoints", {
			category: iconHint || (parsed.name || ""),
			onx_icon: iconHint || undefined,
			onx_color: colorHint || undefined
		}),
		trail_cameras: withProps("trail_cameras", {
			camera_type: name.includes("cell") ? "cell" : "trail",
			onx_icon: iconHint || undefined,
			onx_color: colorHint || undefined
		})
	};

	let layer: string | null = null;
	// Map known prefixes to target layers
	const normalizedPrefix = prefix.replace(/s$/, ""); // handle plural vs singular loosely
	const pickLayerByPrefix = (p: string): string | null => {
		switch (p) {
			case "stand":
				return geomType === "Polygon" ? "tree_stands" : "stands";
			case "spot":
				return "stands";
			case "scrape":
				return "scrapes";
			case "rub":
				return "rubs";
			case "tree":
				return "trees_points";
			case "trail":
				return geomType === "LineString" ? "trails" : null;
			case "bedding":
				return geomType === "Polygon" ? "thick_bedding" : "beds_points";
			case "bed":
				return "beds_points";
			case "flat":
			case "acorn":
				return geomType === "Polygon" ? "acorn_flats" : null;
			case "open":
				return geomType === "Polygon" ? "open_woods" : null;
			case "rock":
				return "big_rocks";
			case "cliff":
				return geomType === "LineString" ? "cliffs" : null;
			case "ravine":
				return geomType === "LineString" ? "ravines" : null;
			case "stream":
			case "creek":
				return geomType === "LineString" ? "streams" : null;
			case "hunt":
				return "hunts";
			case "sighting":
				return "animal_sightings";
			default:
				return null;
		}
	};
	const layerFromPrefix = pickLayerByPrefix(normalizedPrefix);
	if (layerFromPrefix && features[layerFromPrefix]) {
		layer = layerFromPrefix;
	} else if (!opts.useHeuristics) {
		return null;
	} else {
		// Trail camera name heuristics (onX often exports these as generic "Location" icons)
		if (!layer && geomType === "Point") {
			const camRe =
				/\b(trail\s*cam(era)?|trailcam|cell\s*cam(era)?|cellcam|camera|cam)\b/i;
			if (camRe.test(parsed.name || "") || camRe.test(name) || iconHint.includes("camera") || iconHint.includes("trail cam")) {
				layer = "trail_cameras";
			}
		}

		// onX exports often don't use prefixes; use icon hints for Point Placemarks.
		if (!layer && geomType === "Point" && iconHint) {
			if (iconHint.includes("ladder stand") || iconHint.includes("treestand") || iconHint.includes("tree stand") || iconHint === "stand") {
				layer = "stands";
			} else if (iconHint.includes("blind")) {
				layer = "stands";
			} else if (iconHint.includes("bedding")) {
				layer = "beds_points";
			} else {
				// Location, Access, Trail Cam, etc.
				layer = "waypoints";
			}
		}

		// Try folder hint from KML if available
		const folderHint = String((parsed.props as any)?.folder_hint || "").toLowerCase();
		const include = (s: string) => name.includes(s) || folderHint.includes(s);
		if (folderHint) {
			if (folderHint.includes("trail")) {
				layer = "trails";
			} else if (folderHint.includes("bedding")) {
				layer = geomType === "Polygon" ? "thick_bedding" : "beds_points";
			} else if (folderHint.includes("bed")) {
				layer = "beds_points";
			} else if (folderHint.includes("acorn") || folderHint.includes("flat")) {
				layer = geomType === "Polygon" ? "acorn_flats" : null;
			} else if (folderHint.includes("open")) {
				layer = geomType === "Polygon" ? "open_woods" : null;
			} else if (folderHint.includes("rock")) {
				layer = "big_rocks";
			} else if (folderHint.includes("cliff")) {
				layer = geomType === "LineString" ? "cliffs" : null;
			} else if (folderHint.includes("ravine")) {
				layer = geomType === "LineString" ? "ravines" : null;
			} else if (folderHint.includes("stream") || folderHint.includes("creek")) {
				layer = geomType === "LineString" ? "streams" : null;
			} else if (folderHint.includes("sighting")) {
				layer = "animal_sightings";
			} else if (folderHint.includes("hunt")) {
				layer = "hunts";
			} else if (folderHint.includes("stand")) {
				layer = geomType === "Polygon" ? "tree_stands" : "stands";
			}
		}
		// fallback by geometry type if still unresolved
		if (!layer) {
			// keyword-based matching within the name for friendlier imports
			if (include("stand")) {
				layer = geomType === "Polygon" ? "tree_stands" : "stands";
			} else if (include("spot")) {
				layer = "stands";
			} else if (include("scrape")) {
				layer = "scrapes";
			} else if (include("rub")) {
				layer = "rubs";
			} else if (include("tree")) {
				layer = "trees_points";
			} else if (include("bed")) {
				layer = geomType === "Polygon" ? "thick_bedding" : "beds_points";
			} else if (include("sighting")) {
				layer = "animal_sightings";
			} else if (include("hunt")) {
				layer = "hunts";
			} else if (include("cliff")) {
				layer = geomType === "LineString" ? "cliffs" : null;
			} else if (include("ravine")) {
				layer = geomType === "LineString" ? "ravines" : null;
			} else if (include("creek") || include("stream")) {
				layer = geomType === "LineString" ? "streams" : null;
			}
		}
		if (!layer) {
			if (geomType === "LineString") {
				layer = opts.tracksTarget === "animal_paths" ? "animal_paths" : "trails";
			} else if (geomType === "Polygon") {
				layer = "open_woods";
			} else {
				// points with no prefix/heuristic match go to waypoints
				layer = "waypoints";
			}
		}
	}
	const feature = (features[layer as string] ||
		withProps(layer as string, {})) as GeoJSON.Feature;
	// Hunts: map GPX time to local date/start_time if present
	if (layer === "hunts") {
		const rawTime = String((parsed.props as any)?.time || "").trim();
		if (rawTime) {
			const d = new Date(rawTime);
			if (!isNaN(d.getTime())) {
				try {
					const fmt = new Intl.DateTimeFormat("en-CA", {
						timeZone: opts.timeZone,
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
						hour: "2-digit",
						minute: "2-digit",
						hour12: false
					} as any);
					const parts = fmt.formatToParts(d);
					const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
					const yyyy = get("year");
					const mm = get("month");
					const dd = get("day");
					const hh = get("hour");
					const min = get("minute");
					(feature.properties as any).date = `${yyyy}-${mm}-${dd}`;
					(feature.properties as any).start_time = `${hh}:${min}`;
				} catch {
					// ignore tz formatting failures
				}
			}
		}
	}
	// Set basic metadata expected by the app
	const props = (feature.properties as Record<string, unknown>) || {};
	if (!props.name) {
		props.name = parsed.name || "";
	}
	if (!props.date) {
		const now = new Date(opts.importTimestamp);
		const yyyy = now.getFullYear();
		const mm = String(now.getMonth() + 1).padStart(2, "0");
		const dd = String(now.getDate()).padStart(2, "0");
		props.date = `${yyyy}-${mm}-${dd}`;
	}
	props.imported_by = opts.activeUser;
	props.imported_at = opts.importTimestamp;
	if (!props.created_by) props.created_by = opts.activeUser;
	if (!props.created_at) props.created_at = opts.importTimestamp;
	feature.properties = props;
	const signature = buildSignature(feature);
	return { layerId: layer as string, feature, signature };
}

export function buildSignature(f: GeoJSON.Feature): string {
	const name = String((f.properties as any)?.name || "").toLowerCase();
	if (f.geometry.type === "Point") {
		const [x, y] = (f.geometry.coordinates as number[]).map((n) =>
			Number(n.toFixed(6))
		);
		return `pt:${x},${y}:${name}`;
	}
	if (f.geometry.type === "LineString") {
		const coords = f.geometry.coordinates as number[][];
		if (coords.length < 2) return `line:${name}`;
		const a = coords[0].map((n) => Number(n.toFixed(6))).join(",");
		const b = coords[coords.length - 1].map((n) => Number(n.toFixed(6))).join(",");
		return `line:${a}-${b}:${name}`;
	}
	if (f.geometry.type === "Polygon") {
		const coords = f.geometry.coordinates as number[][][];
		const ring = coords[0] || [];
		const a = (ring[0] || []).map((n) => Number(n.toFixed(6))).join(",");
		return `poly:${a}:${name}`;
	}
	return `geom:${f.geometry.type}:${name}`;
}


