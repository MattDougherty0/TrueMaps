import { mapOnxToSchema, buildSignature } from "../mapOnxToSchema";
import type { ImportOptions, ParsedFeature } from "../types";

export function runOnxMappingTests(): { passed: number; failed: Array<{ name: string; reason: string }> } {
	const failures: Array<{ name: string; reason: string }> = [];
	const opts: ImportOptions = {
		projectDir: "/dev/null",
		inputFiles: [],
		tracksTarget: "trails",
		timeZone: "America/New_York",
		useHeuristics: true,
		onlyPoints: false,
		activeUser: "Tester",
		importTimestamp: "2025-01-01T12:00:00Z"
	};
	const tests: Array<{
		name: string;
		parsed: ParsedFeature;
		expectLayer: string | null;
		expectProps?: Record<string, unknown>;
	}> = [
		{
			name: "stand: climber -> stands",
			parsed: {
				name: "stand: climber",
				desc: "",
				geometry: { type: "Point", coordinates: [0, 0] }
			},
			expectLayer: "stands",
			expectProps: { stand_type: "climber" }
		},
		{
			name: "scrape: fresh -> scrapes",
			parsed: {
				name: "scrape: fresh",
				desc: "",
				geometry: { type: "Point", coordinates: [0, 0] }
			},
			expectLayer: "scrapes",
			expectProps: { freshness: "fresh" }
		},
		{
			name: "rub: 8in -> rubs",
			parsed: {
				name: "rub: 8in",
				desc: "",
				geometry: { type: "Point", coordinates: [0, 0] }
			},
			expectLayer: "rubs"
		},
		{
			name: "trail: deer main (LineString) -> trails",
			parsed: {
				name: "trail: deer main",
				desc: "",
				geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }
			},
			expectLayer: "trails",
			expectProps: { trail_type: "deer", prominence: "main" }
		},
		{
			name: "bedding: hemlock (Polygon) -> bedding_areas",
			parsed: {
				name: "bedding: hemlock",
				desc: "",
				geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] }
			},
			expectLayer: "bedding_areas"
		},
		{
			name: "flat: acorn 4/5 (Polygon) -> acorn_flats",
			parsed: {
				name: "flat: acorn 4/5",
				desc: "",
				geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 0]]] }
			},
			expectLayer: "acorn_flats"
		}
	];
	for (const t of tests) {
		const mapped = mapOnxToSchema(t.parsed, opts);
		if (!t.expectLayer) {
			if (mapped !== null) {
				failures.push({ name: t.name, reason: `Expected null, got layer ${mapped.layerId}` });
			}
			continue;
		}
		if (!mapped) {
			failures.push({ name: t.name, reason: `Expected ${t.expectLayer}, got null` });
			continue;
		}
		if (mapped.layerId !== t.expectLayer) {
			failures.push({ name: t.name, reason: `Expected ${t.expectLayer}, got ${mapped.layerId}` });
			continue;
		}
		if (t.expectProps) {
			for (const [k, v] of Object.entries(t.expectProps)) {
				if ((mapped.feature.properties as any)?.[k] !== v) {
					failures.push({
						name: t.name,
						reason: `Expected property ${k}=${String(v)}, got ${String(
							(mapped.feature.properties as any)?.[k]
						)}`
					});
					break;
				}
			}
		}
		// sanity: original name preserved
		const originalName = t.parsed.name || "";
		if ((mapped.feature.properties as any)?.name !== originalName) {
			failures.push({
				name: t.name,
				reason: `Expected name "${originalName}", got "${String((mapped.feature.properties as any)?.name)}"`
			});
		}
		// sanity: signature builds
		const sig = buildSignature(mapped.feature);
		if (typeof sig !== "string" || sig.length === 0) {
			failures.push({ name: t.name, reason: "Signature not generated" });
		}
	}
	return { passed: tests.length - failures.length, failed: failures };
}


