import type { ImportReport } from "./types";

export async function writeReport(
	projectDir: string,
	report: ImportReport
): Promise<string> {
	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const rel = `imports/import_report_${ts}.json`;
	await window.api.writeTextFile(projectDir, rel, JSON.stringify(report, null, 2));
	return rel;
}


