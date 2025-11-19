import type { LayerId } from "./schema";
import type { FeatureLike } from "ol/Feature";
import { useFiltersStore } from "../../state/filters";
import { useVisibilityStore } from "../../state/visibility";
import { getMap } from "../../state/map";

export function shouldShowFeature(layerId: LayerId, feature: FeatureLike): boolean {
	// Species filtering for relevant layers
	const { species, signTypes, onlyMine, temporalView } = useFiltersStore.getState();
	const { timeWindow } = useVisibilityStore.getState();

	// Permanent-only view
	const permanentLayers: LayerId[] = ["property_boundary", "streams", "cliffs", "ravines", "big_rocks"];
	if (temporalView === "permanentOnly") {
		return permanentLayers.includes(layerId);
	}

	if (species.size > 0) {
		const sp = feature?.get?.("species");
		if (sp && !species.has(String(sp))) return false;
	}
	// Sign type filtering
	if (signTypes.size > 0) {
		// animal_sign uses sign_type field
		const st = feature?.get?.("sign_type");
		if (st && !signTypes.has(String(st))) return false;
		// Map rub/scrape layers to sign types
		if (layerId === "rubs" && !signTypes.has("rub")) return false;
		if (layerId === "scrapes" && !signTypes.has("scrape")) return false;
	}
	// Only mine (created_by)
	if (onlyMine) {
		const createdBy = feature?.get?.("created_by");
		const active = (window as any).__ACTIVE_USER__ as string | undefined;
		if (active && createdBy && String(createdBy) !== active) return false;
	}

	// Time-based filtering
	// Effective window: if timeWindow === 'all' and temporalView === 'recentOnly', default to 1y
	const windowDays =
		timeWindow === "1y" ? 365 : timeWindow === "5y" ? 365 * 5 : temporalView === "recentOnly" ? 365 : null;
	if (windowDays !== null) {
		// attempt to extract ISO date from known field(s)
		const raw = feature?.get?.("date");
		if (!raw || typeof raw !== "string") {
			// No date means we hide in a time-limited view
			return false;
		}
		// Validate format yyyy-mm-dd; tolerate minor variations
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
		if (!m) return false;
		const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
		if (Number.isNaN(d.getTime())) return false;
		const now = Date.now();
		const diffDays = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays > windowDays) return false;
	}
	// Add zoom-based hiding for small features
	const map = getMap(); // Assume you have a way to get current map instance
	const zoom = map?.getView()?.getZoom() || 10;
	const smallFeatures = ["scrapes", "rubs", "beds_points", "animal_sign"];
	if (smallFeatures.includes(layerId) && zoom < 14) return false; // Hide below zoom 14
	return true;
}

export function getAgeOpacity(layerId: LayerId, feature: FeatureLike): number {
	// Only apply when some time context is active; otherwise 1
	const { temporalView } = useFiltersStore.getState();
	const { timeWindow } = useVisibilityStore.getState();
	if (temporalView === "permanentOnly") return 1;
	// Determine window span in days for scaling
	const spanDays = timeWindow === "1y" ? 365 : timeWindow === "5y" ? 365 * 5 : null;
	if (!spanDays) return 1;
	const raw = feature?.get?.("date");
	if (!raw || typeof raw !== "string") return 0.6; // unknown date → subtly deemphasize
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
	if (!m) return 0.6;
	const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return 0.6;
	const now = Date.now();
	const diffDays = Math.max(0, Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24)));
	// Map 0..spanDays to opacity 1..0.35 (clamped)
	const t = Math.min(1, diffDays / spanDays);
	const opacity = 1 - t * 0.65; // 1 → 0.35
	return Math.max(0.35, Math.min(1, opacity));
}


