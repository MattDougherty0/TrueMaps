export type Geometry = GeoJSON.Geometry;

export type ParsedFeature = {
	name: string;
	desc?: string;
	geometry: Geometry;
	props?: Record<string, unknown>;
};

export type TracksTarget = "trails" | "animal_paths";

export type ImportOptions = {
	projectDir: string;
	inputFiles: string[];
	tracksTarget: TracksTarget;
	timeZone: string;
	useHeuristics: boolean;
	onlyPoints?: boolean;
	activeUser: string;
	importTimestamp: string;
};

export type MappedFeature = {
	layerId: string;
	feature: GeoJSON.Feature;
	signature: string;
};

export type ImportReport = {
	countsByLayer: Record<string, number>;
	duplicates: number;
	unknown: { name: string; reason: string; geometryType: string }[];
	errors: { file: string; error: string }[];
	warnings: string[];
};


