import useAppStore from "../state/store";
import { useMediaStore } from "../state/media";
import { findCatalogMatch } from "../lib/media/duplicates";

export default function PhotoPicker({
	onPicked
}: {
	onPicked: (relativePath: string) => void;
}) {
	const { projectPath } = useAppStore();
	const files = useMediaStore((s) => s.files);
	const pick = async () => {
		if (!projectPath) return;
		const filePath = await window.api.chooseFile([
			{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"] }
		]);
		if (!filePath) return;
		if (typeof window.api.hashExternalFiles === "function") {
			const hashed = await window.api.hashExternalFiles([filePath]);
			const hash = hashed[0]?.sha256;
			const existing = hash ? findCatalogMatch(files, hash) : undefined;
			if (existing) {
				onPicked(`media/${existing.path}`);
				return;
			}
		}
		const rel = await window.api.copyToMedia(projectPath, filePath);
		onPicked(rel);
	};
	return (
		<button className="photo-picker-btn" onClick={() => void pick()} disabled={!projectPath}>
			Attach Photo
		</button>
	);
}
