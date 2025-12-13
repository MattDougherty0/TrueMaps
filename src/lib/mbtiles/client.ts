export function mbtilesUrl(tileset: string, propertyId?: string | null): string {
	const suffix = propertyId ? `_${propertyId}` : "";
	return `mbtiles://${tileset}${suffix}/{z}/{x}/{y}.png`;
}


