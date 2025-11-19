import { useCallback, useEffect, useMemo, useState } from "react";
import type { WidgetProps } from "@rjsf/utils";
import useAppStore from "../../state/store";

const containerStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 8
};

const galleryStyle: React.CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: 8
};

const thumbWrapperStyle: React.CSSProperties = {
	position: "relative",
	width: 96,
	height: 72,
	borderRadius: 6,
	overflow: "hidden",
	border: "1px solid rgba(0,0,0,0.1)",
	background: "#f3f3f3"
};

const removeButtonStyle: React.CSSProperties = {
	position: "absolute",
	top: 4,
	right: 4,
	border: "none",
	borderRadius: "50%",
	width: 18,
	height: 18,
	background: "rgba(0,0,0,0.65)",
	color: "#fff",
	cursor: "pointer",
	fontSize: 12,
	lineHeight: "18px",
	padding: 0
};

const emptyStyle: React.CSSProperties = {
	fontSize: 12,
	color: "rgba(0,0,0,0.45)"
};

const buttonStyle: React.CSSProperties = {
	alignSelf: "flex-start",
	padding: "6px 12px",
	borderRadius: 6,
	border: "1px solid rgba(0,0,0,0.12)",
	background: "#f7f7f7",
	cursor: "pointer"
};

const fileNameStyle: React.CSSProperties = {
	fontSize: 10,
	padding: 6,
	display: "block",
	lineHeight: 1.2
};

const normalizeToArray = (value: unknown): string[] => {
	if (!value) return [];
	if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
	if (typeof value === "string") return [value];
	return [];
};

const toFileUrl = (absolutePath: string) => {
	const normalized = absolutePath.replace(/\\/g, "/");
	return `file://${encodeURI(normalized)}`;
};

const PhotoGalleryWidget = (props: WidgetProps) => {
	const { value, onChange, disabled, readonly } = props;
	const { projectPath } = useAppStore();
	const photos = useMemo(() => normalizeToArray(value), [value]);
	const [previews, setPreviews] = useState<Record<string, string>>({});

	useEffect(() => {
		let cancelled = false;
		if (!projectPath || photos.length === 0) {
			setPreviews({});
			return () => {
				cancelled = true;
			};
		}

		const load = async () => {
			const entries: Record<string, string> = {};
			for (const rel of photos) {
				try {
					const abs = await window.api.resolveMediaPath(projectPath, rel);
					entries[rel] = toFileUrl(abs);
				} catch {
					entries[rel] = "";
				}
			}
			if (!cancelled) {
				setPreviews(entries);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [photos, projectPath]);

	const pickPhotos = useCallback(async () => {
		if (!projectPath) return;
		const filePaths = await window.api.chooseFiles([
			{
				name: "Images",
				extensions: ["jpg", "jpeg", "png", "webp", "gif", "heic"]
			}
		]);
		if (!filePaths || filePaths.length === 0) return;
		const rels: string[] = [];
		for (const filePath of filePaths) {
			const rel = await window.api.copyToMedia(projectPath, filePath);
			rels.push(rel);
		}
		onChange([...photos, ...rels]);
	}, [photos, onChange, projectPath]);

	const removePhoto = useCallback(
		(rel: string) => {
			onChange(photos.filter((p) => p !== rel));
		},
		[photos, onChange]
	);

	const openPreview = useCallback((rel: string) => {
		const url = previews[rel];
		if (url) {
			window.open(url, "_blank");
		}
	}, [previews]);

	const canEdit = !disabled && !readonly;

	return (
		<div style={containerStyle}>
			<div style={galleryStyle}>
				{photos.map((rel) => (
					<div key={rel} style={thumbWrapperStyle}>
						{previews[rel] ? (
							<img
								src={previews[rel]}
								alt={rel}
								style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
								onClick={() => openPreview(rel)}
							/>
						) : (
							<span style={fileNameStyle}>{rel.split("/").pop()}</span>
						)}
						{canEdit ? (
							<button type="button" onClick={() => removePhoto(rel)} style={removeButtonStyle}>
								×
							</button>
						) : null}
					</div>
				))}
				{photos.length === 0 ? <span style={emptyStyle}>No photos yet.</span> : null}
			</div>
			{canEdit ? (
				<button type="button" style={buttonStyle} onClick={() => void pickPhotos()} disabled={!projectPath}>
					{photos.length ? "Add More Photos" : "Attach Photos"}
				</button>
			) : null}
		</div>
	);
};

export default PhotoGalleryWidget;




