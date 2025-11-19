import { useEffect, useState } from "react";
import useAppStore from "../../state/store";
import { useMediaStore } from "../../state/media";
import type { CSSProperties } from "react";

const toMediaUrl = (absolutePath: string, projectPath: string) => {
	// Convert absolute path to relative path from project root, excluding "media/" prefix
	const normalized = absolutePath.replace(/\\/g, "/");
	const projectNormalized = projectPath.replace(/\\/g, "/");
	if (normalized.startsWith(projectNormalized)) {
		let relative = normalized.slice(projectNormalized.length).replace(/^\/+/, "");
		// Remove "media/" prefix if present (protocol handler adds it)
		if (relative.startsWith("media/")) {
			relative = relative.slice(6);
		}
		// Use media:// protocol with proper path format (three slashes for absolute path)
		// Encode each path segment separately to handle spaces and special chars
		const segments = relative.split("/").map(seg => encodeURIComponent(seg));
		return `media:///${segments.join("/")}`;
	}
	// Fallback: try to extract just the media/ portion
	const mediaMatch = normalized.match(/media\/(.+)$/);
	if (mediaMatch) {
		const segments = mediaMatch[1].split("/").map(seg => encodeURIComponent(seg));
		return `media:///${segments.join("/")}`;
	}
	return "";
};

const getVideoMimeType = (fileName: string): string => {
	const ext = fileName.toLowerCase().split(".").pop();
	const mimeTypes: Record<string, string> = {
		mp4: "video/mp4",
		mov: "video/quicktime",
		avi: "video/x-msvideo",
		mkv: "video/x-matroska",
		webm: "video/webm"
	};
	return mimeTypes[ext || ""] || "video/mp4";
};

export default function MediaViewer() {
	const { projectPath } = useAppStore();
	const { selectedFile, viewerOpen, setViewerOpen, updateFile, saveToProject, files } = useMediaStore();
	const [notes, setNotes] = useState("");
	const [editingNotes, setEditingNotes] = useState(false);
	const [mediaUrl, setMediaUrl] = useState<string>("");
	const [videoError, setVideoError] = useState<string | null>(null);

	useEffect(() => {
		if (selectedFile) {
			setNotes(selectedFile.notes || "");
			setEditingNotes(false);
			setVideoError(null); // Reset error when file changes
		}
	}, [selectedFile]);

	useEffect(() => {
		if (!selectedFile || !projectPath) {
			setMediaUrl("");
			return;
		}

		const loadUrl = async () => {
			try {
				// Resolve actual file path (may be in nested folder or root)
				const actualPath = selectedFile.path.includes("/") ? selectedFile.path : selectedFile.name;
				const relativePath = `media/${actualPath}`;
				const abs = await window.api.resolveMediaPath(projectPath, relativePath);
				setMediaUrl(toMediaUrl(abs, projectPath));
			} catch (err) {
				console.error("Failed to resolve media path", err);
				setMediaUrl("");
			}
		};

		void loadUrl();
	}, [selectedFile, projectPath]);

	if (!viewerOpen || !selectedFile || !projectPath) return null;

	const currentIndex = files.findIndex((f) => f.id === selectedFile.id);
	const hasNext = currentIndex < files.length - 1;
	const hasPrev = currentIndex > 0;

	const handleNext = () => {
		if (hasNext) {
			const nextFile = files[currentIndex + 1];
			useMediaStore.getState().setSelectedFile(nextFile);
		}
	};

	const handlePrev = () => {
		if (hasPrev) {
			const prevFile = files[currentIndex - 1];
			useMediaStore.getState().setSelectedFile(prevFile);
		}
	};

	const handleSaveNotes = async () => {
		if (!selectedFile) return;
		updateFile(selectedFile.id, { notes });
		await saveToProject(projectPath);
		setEditingNotes(false);
	};

	const overlayStyle: CSSProperties = {
		position: "fixed",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		background: "rgba(0,0,0,0.95)",
		zIndex: 3000,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center"
	};

	const contentStyle: CSSProperties = {
		width: "100%",
		height: "100%",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		position: "relative"
	};

	const mediaContainerStyle: CSSProperties = {
		flex: 1,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		maxHeight: "calc(100vh - 200px)",
		position: "relative"
	};

	return (
		<div style={overlayStyle} onClick={() => setViewerOpen(false)}>
			<div style={contentStyle} onClick={(e) => e.stopPropagation()}>
				{/* Close button */}
				<button
					onClick={() => setViewerOpen(false)}
					style={{
						position: "absolute",
						top: 20,
						right: 20,
						padding: "8px 16px",
						border: "1px solid rgba(255,255,255,0.3)",
						borderRadius: 6,
						background: "rgba(255,255,255,0.1)",
						color: "#ffffff",
						cursor: "pointer",
						fontSize: 13,
						zIndex: 10
					}}
				>
					Close (ESC)
				</button>

				{/* Navigation */}
				{hasPrev && (
					<button
						onClick={handlePrev}
						style={{
							position: "absolute",
							left: 20,
							top: "50%",
							transform: "translateY(-50%)",
							padding: "12px 20px",
							border: "1px solid rgba(255,255,255,0.3)",
							borderRadius: 6,
							background: "rgba(255,255,255,0.1)",
							color: "#ffffff",
							cursor: "pointer",
							fontSize: 16,
							zIndex: 10
						}}
					>
						← Prev
					</button>
				)}
				{hasNext && (
					<button
						onClick={handleNext}
						style={{
							position: "absolute",
							right: 20,
							top: "50%",
							transform: "translateY(-50%)",
							padding: "12px 20px",
							border: "1px solid rgba(255,255,255,0.3)",
							borderRadius: 6,
							background: "rgba(255,255,255,0.1)",
							color: "#ffffff",
							cursor: "pointer",
							fontSize: 16,
							zIndex: 10
						}}
					>
						Next →
					</button>
				)}

				{/* Media */}
				<div style={mediaContainerStyle}>
					{selectedFile.type === "image" ? (
						<img
							src={mediaUrl}
							alt={selectedFile.name}
							style={{
								maxWidth: "100%",
								maxHeight: "100%",
								objectFit: "contain"
							}}
						/>
					) : videoError ? (
						<div
							style={{
								padding: 40,
								textAlign: "center",
								color: "#ffffff",
								background: "rgba(255,0,0,0.1)",
								borderRadius: 8,
								border: "1px solid rgba(255,0,0,0.3)"
							}}
						>
							<div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
								Video Playback Error
							</div>
							<div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 8 }}>
								{selectedFile.name}
							</div>
							<div style={{ fontSize: 13, color: "#cbd5e1" }}>
								{videoError}
							</div>
							<div style={{ fontSize: 12, color: "#64748b", marginTop: 16 }}>
								.avi files may use codecs not supported by this player.
								<br />
								Try converting to MP4 or use a different video format.
							</div>
						</div>
					) : mediaUrl ? (
						<video
							key={mediaUrl}
							src={mediaUrl}
							controls
							autoPlay
							preload="auto"
							playsInline
							style={{
								maxWidth: "100%",
								maxHeight: "100%"
							}}
							onError={(e) => {
								const video = e.currentTarget;
								const error = video.error;
								let errorMessage = "Unable to play video.";
								
								if (error) {
									switch (error.code) {
										case MediaError.MEDIA_ERR_ABORTED:
											errorMessage = "Video playback was aborted.";
											break;
										case MediaError.MEDIA_ERR_NETWORK:
											errorMessage = "Network error while loading video.";
											break;
										case MediaError.MEDIA_ERR_DECODE:
											errorMessage = "Video codec not supported or file is corrupted.";
											break;
										case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
											errorMessage = "Video format not supported.";
											break;
										default:
											errorMessage = error.message || `Error code: ${error.code}`;
									}
								} else {
									errorMessage = "Video failed to load (no error details available).";
								}
								
								console.error("Video playback error:", errorMessage, error, "URL:", mediaUrl);
								setVideoError(errorMessage);
							}}
							onLoadedMetadata={() => {
								console.log("Video metadata loaded successfully:", mediaUrl);
								setVideoError(null);
							}}
							onCanPlay={() => {
								console.log("Video can play:", mediaUrl);
								setVideoError(null);
							}}
							onLoadStart={() => {
								console.log("Video load started:", mediaUrl);
							}}
						>
							Your browser does not support the video tag or this video format.
						</video>
					) : (
						<div style={{ padding: 40, textAlign: "center", color: "#ffffff" }}>
							Loading video...
						</div>
					)}
				</div>

				{/* Info Panel */}
				<div
					style={{
						width: "100%",
						maxWidth: 800,
						padding: 20,
						background: "rgba(30,41,59,0.8)",
						borderTop: "1px solid rgba(255,255,255,0.1)"
					}}
				>
					<div style={{ color: "#ffffff", marginBottom: 12 }}>
						<div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{selectedFile.name}</div>
						<div style={{ fontSize: 12, color: "#94a3b8" }}>
							{new Date(selectedFile.createdAt).toLocaleDateString()} • {selectedFile.type}
						</div>
					</div>
					{editingNotes ? (
						<div>
							<textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Add notes..."
								style={{
									width: "100%",
									minHeight: 80,
									padding: 8,
									border: "1px solid rgba(255,255,255,0.2)",
									borderRadius: 4,
									background: "rgba(0,0,0,0.3)",
									color: "#ffffff",
									fontSize: 13,
									fontFamily: "inherit",
									resize: "vertical"
								}}
							/>
							<div style={{ display: "flex", gap: 8, marginTop: 8 }}>
								<button
									onClick={() => void handleSaveNotes()}
									style={{
										padding: "6px 12px",
										border: "1px solid #0a84ff",
										borderRadius: 4,
										background: "#0a84ff",
										color: "#ffffff",
										cursor: "pointer",
										fontSize: 12
									}}
								>
									Save
								</button>
								<button
									onClick={() => {
										setNotes(selectedFile.notes || "");
										setEditingNotes(false);
									}}
									style={{
										padding: "6px 12px",
										border: "1px solid rgba(255,255,255,0.2)",
										borderRadius: 4,
										background: "transparent",
										color: "#ffffff",
										cursor: "pointer",
										fontSize: 12
									}}
								>
									Cancel
								</button>
							</div>
						</div>
					) : (
						<div>
							<div
								style={{
									padding: 12,
									background: "rgba(0,0,0,0.3)",
									borderRadius: 4,
									color: "#e2e8f0",
									fontSize: 13,
									minHeight: 60,
									whiteSpace: "pre-wrap"
								}}
							>
								{selectedFile.notes || "No notes"}
							</div>
							<button
								onClick={() => setEditingNotes(true)}
								style={{
									marginTop: 8,
									padding: "6px 12px",
									border: "1px solid rgba(255,255,255,0.2)",
									borderRadius: 4,
									background: "transparent",
									color: "#ffffff",
									cursor: "pointer",
									fontSize: 12
								}}
							>
								{selectedFile.notes ? "Edit Notes" : "Add Notes"}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

