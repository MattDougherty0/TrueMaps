import type { MappedFeature } from "./types";

export async function isDuplicate(
	projectDir: string,
	layerFile: string,
	mapped: MappedFeature
): Promise<boolean> {
	try {
		const text = await window.api.readTextFile(projectDir, `data/${layerFile}`);
		const fc = JSON.parse(text || "{\"type\":\"FeatureCollection\",\"features\":[]}");
		for (const f of fc.features || []) {
			const existingSig = signatureOfExisting(f);
			if (existingSig === mapped.signature) return true;
		}
		return false;
	} catch {
		return false;
	}
}

function signatureOfExisting(f: any): string {
	const name = String(f?.properties?.name || "").toLowerCase();
	if (f?.geometry?.type === "Point") {
		const [x, y] = (f.geometry.coordinates as number[]).map((n) =>
			Number(n.toFixed(6))
		);
		return `pt:${x},${y}:${name}`;
	}
	if (f?.geometry?.type === "LineString") {
		const coords = f.geometry.coordinates as number[][];
		if (!coords || coords.length < 2) return `line:${name}`;
		const a = coords[0].map((n) => Number(n.toFixed(6))).join(",");
		const b = coords[coords.length - 1].map((n) => Number(n.toFixed(6))).join(",");
		return `line:${a}-${b}:${name}`;
	}
	if (f?.geometry?.type === "Polygon") {
		const ring = (f.geometry.coordinates?.[0] || []) as number[][];
		const a = (ring[0] || []).map((n) => Number(n.toFixed(6))).join(",");
		return `poly:${a}:${name}`;
	}
	return `geom:${f?.geometry?.type}:${name}`;
}


