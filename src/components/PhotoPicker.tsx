import useAppStore from "../state/store";

export default function PhotoPicker({
	onPicked
}: {
	onPicked: (relativePath: string) => void;
}) {
	const { projectPath } = useAppStore();
	const pick = async () => {
		if (!projectPath) return;
		const filePath = await window.api.chooseFile([
			{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }
		]);
		if (!filePath) return;
		const rel = await window.api.copyToMedia(projectPath, filePath);
		onPicked(rel);
	};
	return (
		<button onClick={() => void pick()} disabled={!projectPath}>
			Attach Photo
		</button>
	);
}


