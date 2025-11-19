import { parseKml } from "./parseKml";
import { parseGpx } from "./parseGpx";
import { mapOnxToSchema } from "./mapOnxToSchema";
import { isDuplicate } from "./dedupe";
import { appendToLayer } from "./writer";
import { writeReport } from "./report";
import type { ImportOptions, ImportReport, TracksTarget } from "./types";
import { layerConfigById } from "../../lib/geo/layerConfig";

export async function importOnx(opts: ImportOptions): Promise<ImportReport> {
	const report: ImportReport = {
		countsByLayer: {},
		duplicates: 0,
		unknown: [],
		errors: [],
		warnings: ["Photos are not included in onX exports"]
	};

	const parsedAll: { file: string; pf: any }[] = [];
	for (const file of opts.inputFiles) {
		try {
			if (file.toLowerCase().endsWith(".kml")) {
				const pf = await parseKml(file);
				parsedAll.push(...pf.map((p) => ({ file, pf: p })));
			} else if (file.toLowerCase().endsWith(".gpx")) {
				const pf = await parseGpx(file);
				parsedAll.push(...pf.map((p) => ({ file, pf: p })));
			} else {
				report.warnings.push(`Unsupported file: ${file}`);
			}
		} catch (e: any) {
			report.errors.push({ file, error: String(e?.message || e) });
		}
	}

	for (const { file, pf } of parsedAll) {
		try {
			if (opts.onlyPoints && pf?.geometry?.type !== "Point") {
				continue;
			}
			const mapped = mapOnxToSchema(pf, opts);
			if (!mapped) {
				report.unknown.push({
					name: pf.name || "",
					reason: "no prefix or unsupported geometry",
					geometryType: pf?.geometry?.type || "Unknown"
				});
				continue;
			}
			const cfg = layerConfigById[mapped.layerId as keyof typeof layerConfigById];
			if (!cfg) {
				report.unknown.push({
					name: pf.name || "",
					reason: `no layer config for ${mapped.layerId}`,
					geometryType: pf?.geometry?.type || "Unknown"
				});
				continue;
			}
			const dup = await isDuplicate(opts.projectDir, cfg.file, mapped);
			if (dup) {
				report.duplicates += 1;
				continue;
			}
			await appendToLayer(opts.projectDir, cfg.file, mapped.feature);
			report.countsByLayer[mapped.layerId] =
				(report.countsByLayer[mapped.layerId] || 0) + 1;
		} catch (e: any) {
			report.errors.push({ file, error: String(e?.message || e) });
		}
	}

	return report;
}

export async function runOnxImportWithDialog(
	projectDir: string,
	options?: {
		tracksTarget?: TracksTarget;
		timeZone?: string;
		useHeuristics?: boolean;
		onlyPoints?: boolean;
		activeUser: string;
	}
): Promise<string | null> {
	const inputs = await window.api.chooseFiles([
		{ name: "onX Exports", extensions: ["kml", "gpx"] }
	]);
	if (!inputs || inputs.length === 0) return null;
	const tracksTarget: TracksTarget = options?.tracksTarget || "trails";
	const timeZone = options?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
	const useHeuristics = options?.useHeuristics ?? true;
	const onlyPoints = options?.onlyPoints ?? false;
	const activeUser = options?.activeUser;
	if (!activeUser) {
		throw new Error("Active user required for import");
	}
	const importTimestamp = new Date().toISOString();
	const report = await importOnx({
		projectDir,
		inputFiles: inputs,
		tracksTarget,
		timeZone,
		useHeuristics,
		onlyPoints,
		activeUser,
		importTimestamp
	});
	const rel = await writeReport(projectDir, report);
	// Notify map layers to reload their data
	try {
		window.dispatchEvent(new Event("layers:reload"));
	} catch {
		// ignore
	}
	return rel;
}


