import { gpx } from "@tmcw/togeojson";
import { ParsedFeature } from "./types";

export async function parseGpx(filePath: string): Promise<ParsedFeature[]> {
	const xml = await window.api.readExternalFile(filePath);
	const doc = new DOMParser().parseFromString(xml, "text/xml");
	const gj = gpx(doc) as GeoJSON.FeatureCollection;
	const out: ParsedFeature[] = [];
	for (const f of gj.features || []) {
		const name = String((f.properties as any)?.name || "").trim();
		const desc = (f.properties as any)?.desc as string | undefined;
		if (!f.geometry) continue;
		out.push({
			name,
			desc,
			geometry: f.geometry,
			props: f.properties as any
		});
	}
	return out;
}


