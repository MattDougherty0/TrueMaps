import proj4 from "proj4";
import { register } from "ol/proj/proj4";

export type UtmChoice = {
	code: string;
	utmZone: number;
	isNorthern: boolean;
};

export function pickUtmFromLonLat(lon: number, lat: number): UtmChoice {
	const zone = Math.floor((lon + 180) / 6) + 1;
	const isNorthern = lat >= 0;
	const epsg = isNorthern ? 32600 + zone : 32700 + zone; // WGS84 UTM N/S EPSG codes
	const code = `EPSG:${epsg}`;
	return { code, utmZone: zone, isNorthern };
}

export function registerUtmProjection(choice: UtmChoice): void {
	const { utmZone, isNorthern, code } = choice;
	const projDef = `+proj=utm +zone=${utmZone} ${isNorthern ? "+north " : ""}+datum=WGS84 +units=m +no_defs`;
	proj4.defs(code, projDef);
	register(proj4);
}


