import { getMap } from "../../state/map";
import { useVisibilityStore } from "../../state/visibility";

function niceScale(targetMeters: number): { meters: number; label: string } {
	const candidates = [5, 10, 20, 50, 100, 200, 500, 1000];
	let best = candidates[0];
	for (const c of candidates) {
		if (Math.abs(c - targetMeters) < Math.abs(best - targetMeters)) best = c;
	}
	return { meters: best, label: best >= 1000 ? `${best / 1000} km` : `${best} m` };
}

export async function printCurrentMap(projectPath: string): Promise<string | null> {
	const map = getMap();
	if (!map) return null;
	// Combine map canvases into one
	const viewEl = map.getViewport() as HTMLElement;
	const canvases = Array.from(viewEl.querySelectorAll("canvas")) as HTMLCanvasElement[];
	if (canvases.length === 0) return null;
	const width = canvases[0].width;
	const height = canvases[0].height;
	const offscreen = document.createElement("canvas");
	offscreen.width = width;
	offscreen.height = height;
	const ctx = offscreen.getContext("2d");
	if (!ctx) return null;
	for (const c of canvases) {
		ctx.globalAlpha = Number(c.style.opacity || "1") || 1;
		ctx.drawImage(c, 0, 0);
	}
	const dataUrl = offscreen.toDataURL("image/png");
	const imageBase64 = dataUrl.split(",")[1];

	const preset = useVisibilityStore.getState().preset;
	const timeWindow = useVisibilityStore.getState().timeWindow;

	// Approx scale bar length
	const res = map.getView().getResolution() || 1; // meters per pixel (approx in EPSG:3857)
	const targetMeters = res * 150; // aim for ~150px bar
	const nice = niceScale(targetMeters);

	const ts = new Date().toISOString().replace(/[:.]/g, "-");
	const rel = await window.api
		// @ts-expect-error: preload binding exists
		.invoke?.("print:pdf", projectPath, {
			imageBase64,
			imageWidth: width,
			imageHeight: height,
			preset,
			timeWindow,
			scaleMeters: nice.meters,
			scaleLabel: nice.label,
			timestamp: ts
		})
		// Fallback to exposed function via preload
		// @ts-expect-error: types may not include this
		?.catch?.(() =>
			window.api.printPdf(projectPath, {
				imageBase64,
				imageWidth: width,
				imageHeight: height,
				preset,
				timeWindow,
				scaleMeters: nice.meters,
				scaleLabel: nice.label,
				timestamp: ts
			})
		);
	return rel || null;
}


