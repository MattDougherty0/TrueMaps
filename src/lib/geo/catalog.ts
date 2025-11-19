// Centralized catalogs for shared enums across schemas

export const animalSpecies = [
	"whitetail",
	"turkey",
	"bear",
	"coyote",
	"bobcat",
	"fisher",
	"fox",
	"raccoon",
	"porcupine",
	"beaver",
	"other"
] as const;

export const animalSignTypes = [
	"scat",
	"tracks",
	"bed",
	"rub",
	"scrape",
	"feathers",
	"kill_site",
	"hair",
	"other"
] as const;

export const timeOfDay = ["dawn", "day", "dusk", "night"] as const;

export const terrainUse = [
	"ridge",
	"bench",
	"creek",
	"crossing",
	"saddle",
	"logging_road",
	"food",
	"bed",
	"other"
] as const;

export const windRelation = ["upwind", "crosswind", "downwind", "unknown"] as const;

export const ageEstimate = ["1.5", "2.5", "3.5", "4.5+"] as const;

export const mastPresence = ["none", "light", "moderate", "heavy"] as const;

// Expanded tree/shrub species (simple list; can be grouped later)
export const treeAndShrubSpecies = [
	"red_oak",
	"white_oak",
	"chestnut_oak",
	"black_oak",
	"scarlet_oak",
	"hemlock",
	"white_pine",
	"red_pine",
	"spruce",
	"maple",
	"sugar_maple",
	"red_maple",
	"birch",
	"yellow_birch",
	"mountain_laurel",
	"huckleberry",
	"blueberry",
	"cherry",
	"beech",
	"ash",
	"aspen",
	"cedar",
	"other"
] as const;

export const treeSpeciesGroups = [
	"oak",
	"maple",
	"pine",
	"hemlock",
	"spruce",
	"birch",
	"cherry",
	"beech",
	"ash",
	"aspen",
	"cedar",
	"shrub",
	"other"
] as const;

export const treeSpeciesByGroup: Record<string, readonly string[]> = {
	oak: ["red_oak", "white_oak", "chestnut_oak", "black_oak", "scarlet_oak"],
	maple: ["sugar_maple", "red_maple", "maple"],
	pine: ["white_pine", "red_pine"],
	hemlock: ["hemlock"],
	spruce: ["spruce"],
	birch: ["birch", "yellow_birch"],
	cherry: ["cherry"],
	beech: ["beech"],
	ash: ["ash"],
	aspen: ["aspen"],
	cedar: ["cedar"],
	shrub: ["mountain_laurel", "huckleberry", "blueberry"],
	other: ["other"]
};


