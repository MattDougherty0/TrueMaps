import { kml } from "@tmcw/togeojson";
import { ParsedFeature } from "./types";

export async function parseKml(filePath: string): Promise<ParsedFeature[]> {
	const xml = await window.api.readExternalFile(filePath);
	const out: ParsedFeature[] = [];
	try {
		const doc = new DOMParser().parseFromString(xml, "text/xml");
		const gj = kml(doc) as GeoJSON.FeatureCollection;
		// Build a simple index of Placemark name -> nearest Folder name (hint)
		const folderIndex = new Map<string, string>();
		try {
			const placemarks = Array.from(doc.getElementsByTagName("Placemark"));
			for (const pm of placemarks) {
				const nameEl = pm.getElementsByTagName("name")[0];
				const n = (nameEl?.textContent || "").trim();
				if (!n) continue;
				let parent: Node | null = pm.parentNode;
				let folderName = "";
				while (parent) {
					if ((parent as Element).tagName === "Folder") {
						const fn = (parent as Element).getElementsByTagName("name")[0]?.textContent || "";
						if (fn) {
							folderName = fn.trim();
							break;
						}
					}
					parent = parent.parentNode;
				}
				if (folderName) folderIndex.set(n, folderName);
			}
		} catch {
			// ignore XML traversal issues; folder hints are optional
		}
		for (const f of gj.features || []) {
			const name = String((f.properties as any)?.name || "").trim();
			const desc = (f.properties as any)?.description as string | undefined;
			if (!f.geometry) continue;
			out.push({
				name,
				desc,
				geometry: f.geometry,
				props: { ...(f.properties as any), folder_hint: folderIndex.get(name) }
			});
		}
		// If togeojson returned nothing, try a simple fallback for basic Point Placemarks
		if (out.length === 0) {
			const re = /<Placemark[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<Point>[\s\S]*?<coordinates>\s*([-0-9.]+),\s*([-0-9.]+)[^<]*<\/coordinates>[\s\S]*?<\/Placemark>/gi;
			for (const m of xml.matchAll(re)) {
				const nm = (m[1] || "").trim();
				const lon = Number(m[2]);
				const lat = Number(m[3]);
				if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
				out.push({
					name: nm,
					desc: "",
					geometry: { type: "Point", coordinates: [lon, lat] },
					props: {}
				});
			}
		}
		return out;
	} catch {
		// As a last resort, do regex extraction (handles simple onX exports)
		try {
			const re = /<Placemark[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<Point>[\s\S]*?<coordinates>\s*([-0-9.]+),\s*([-0-9.]+)[^<]*<\/coordinates>[\s\S]*?<\/Placemark>/gi;
			for (const m of xml.matchAll(re)) {
				const nm = (m[1] || "").trim();
				const lon = Number(m[2]);
				const lat = Number(m[3]);
				if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
				out.push({
					name: nm,
					desc: "",
					geometry: { type: "Point", coordinates: [lon, lat] },
					props: {}
				});
			}
			return out;
		} catch {
			// If even regex fails, bubble up to caller
			throw new Error("Failed to parse KML");
		}
	}
}


