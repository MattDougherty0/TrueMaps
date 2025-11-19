import { useEffect, useState, useRef, useMemo } from "react";
import useAppStore from "../../state/store";
import { useMediaStore, type MediaFile, type MediaFolder } from "../../state/media";
import MediaViewer from "./MediaViewer";
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

export default function MediaLibrary({ onClose }: { onClose: () => void }) {
	const { projectPath } = useAppStore();
	const {
		folders,
		files,
		currentFolderPath,
		setCurrentFolder,
		addFolder,
		updateFolder,
		deleteFolder,
		addFile,
		updateFile,
		deleteFile,
		moveFile,
		setSelectedFile,
		setViewerOpen,
		loadFromProject,
		saveToProject
	} = useMediaStore();
	const [creatingFolder, setCreatingFolder] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [editingNotes, setEditingNotes] = useState<{ type: "file" | "folder"; id: string } | null>(null);
	const [notesText, setNotesText] = useState("");
	const folderInputRef = useRef<HTMLInputElement>(null);
	const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

	useEffect(() => {
		if (projectPath) {
			void loadFromProject(projectPath);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectPath]); // loadFromProject is stable from Zustand store

	const currentFiles = useMemo(() => {
		return files.filter((f) => {
			const fileFolder = f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : "";
			return fileFolder === currentFolderPath;
		});
	}, [files, currentFolderPath]);

	// Resolve file URLs for all current files
	useEffect(() => {
		let cancelled = false;
		if (!projectPath || currentFiles.length === 0) {
			setFileUrls({});
			return () => {
				cancelled = true;
			};
		}

		const loadUrls = async () => {
			const entries: Record<string, string> = {};
			for (const file of currentFiles) {
				try {
					const actualPath = file.path.includes("/") ? file.path : file.name;
					const relativePath = `media/${actualPath}`;
					const abs = await window.api.resolveMediaPath(projectPath, relativePath);
					entries[file.id] = toMediaUrl(abs, projectPath);
				} catch (err) {
					console.error(`Failed to resolve path for ${file.name}`, err);
					entries[file.id] = "";
				}
			}
			if (!cancelled) {
				setFileUrls(entries);
			}
		};

		void loadUrls();

		return () => {
			cancelled = true;
		};
	}, [projectPath, currentFiles]);

	const currentFolders = folders.filter((f) => {
		const parentPath = f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : "";
		return parentPath === currentFolderPath;
	});

	const breadcrumbs = (() => {
		if (!currentFolderPath) return [];
		const parts = currentFolderPath.split("/").filter(Boolean);
		const crumbs: Array<{ name: string; path: string }> = [];
		for (let i = 0; i < parts.length; i++) {
			crumbs.push({ name: parts[i], path: parts.slice(0, i + 1).join("/") });
		}
		return crumbs;
	})();

	const handleCreateFolder = async () => {
		if (!newFolderName.trim() || !projectPath) return;
		const folderPath = currentFolderPath ? `${currentFolderPath}/${newFolderName.trim()}` : newFolderName.trim();
		const folder: MediaFolder = {
			id: `folder_${Date.now()}_${Math.random().toString(36).slice(2)}`,
			name: newFolderName.trim(),
			path: folderPath,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		addFolder(folder);
		await saveToProject(projectPath);
		setNewFolderName("");
		setCreatingFolder(false);
	};

	const handleUploadFiles = async () => {
		if (!projectPath) return;
		const selectedFiles = await window.api.chooseFiles([
			{ name: "All Media Files", extensions: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "avi", "mkv", "webm"] },
			{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
			{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] },
			{ name: "All Files", extensions: ["*"] }
		]);
		if (!selectedFiles || selectedFiles.length === 0) return;
		for (const absPath of selectedFiles) {
			const originalFileName = absPath.split(/[/\\]/).pop() || "";
			const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(originalFileName);
			const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(originalFileName);
			if (!isVideo && !isImage) continue;
			// Copy file to media directory (handles duplicates, nested folders, and .avi -> .mp4 conversion)
			const copiedRelPath = await window.api.copyToMedia(projectPath, absPath, currentFolderPath || undefined);
			// Extract the actual file name from the returned path (may be .mp4 if converted from .avi)
			// Remove "media/" prefix if present, then get the filename
			let pathWithoutMedia = copiedRelPath.startsWith("media/") ? copiedRelPath.slice(6) : copiedRelPath;
			const actualFileName = pathWithoutMedia.split("/").pop() || originalFileName;
			console.log(`[upload] Original: ${originalFileName}, Copied path: ${copiedRelPath}, Actual filename: ${actualFileName}`);
			const logicalPath = currentFolderPath ? `${currentFolderPath}/${actualFileName}` : actualFileName;
			const mediaFile: MediaFile = {
				id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
				name: actualFileName,
				path: logicalPath,
				type: isVideo ? "video" : "image",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
			addFile(mediaFile);
		}
		await saveToProject(projectPath);
	};

	const handleFileClick = (file: MediaFile) => {
		setSelectedFile(file);
		setViewerOpen(true);
	};

	const handleDeleteFile = async (id: string) => {
		if (!projectPath || !window.confirm("Delete this file?")) return;
		const file = files.find((f) => f.id === id);
		if (file) {
			try {
				const absPath = await window.api.resolveMediaPath(projectPath, `media/${file.path}`);
				await (window.api as any).deleteFile?.(absPath);
			} catch {
				// ignore file system errors
			}
		}
		deleteFile(id);
		await saveToProject(projectPath);
	};

	const handleDeleteFolder = async (id: string) => {
		if (!projectPath || !window.confirm("Delete this folder and all contents?")) return;
		const folder = folders.find((f) => f.id === id);
		if (folder) {
			// Delete all files in this folder
			files.filter((f) => f.path.startsWith(folder.path)).forEach((f) => {
				void handleDeleteFile(f.id);
			});
		}
		deleteFolder(id);
		await saveToProject(projectPath);
	};

	const handleEditNotes = (type: "file" | "folder", id: string) => {
		if (type === "file") {
			const file = files.find((f) => f.id === id);
			setNotesText(file?.notes || "");
		} else {
			const folder = folders.find((f) => f.id === id);
			setNotesText(folder?.notes || "");
		}
		setEditingNotes({ type, id });
	};

	const handleSaveNotes = async () => {
		if (!editingNotes || !projectPath) return;
		if (editingNotes.type === "file") {
			updateFile(editingNotes.id, { notes: notesText });
		} else {
			updateFolder(editingNotes.id, { notes: notesText });
		}
		await saveToProject(projectPath);
		setEditingNotes(null);
		setNotesText("");
	};

	const modalStyle: CSSProperties = {
		position: "fixed",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		background: "rgba(0,0,0,0.5)",
		zIndex: 2000,
		display: "flex",
		alignItems: "center",
		justifyContent: "center"
	};

	const panelStyle: CSSProperties = {
		width: "90%",
		maxWidth: 1200,
		height: "85%",
		background: "#ffffff",
		borderRadius: 8,
		boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
		display: "flex",
		flexDirection: "column",
		overflow: "hidden"
	};

	return (
		<>
			<div style={modalStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
				<div style={panelStyle} onClick={(e) => e.stopPropagation()}>
					{/* Header */}
					<div
						style={{
							padding: "16px 20px",
							borderBottom: "1px solid rgba(15,23,42,0.1)",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center"
						}}
					>
						<h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>My Content</h2>
						<button
							onClick={onClose}
							style={{
								padding: "6px 12px",
								border: "1px solid rgba(15,23,42,0.2)",
								borderRadius: 6,
								background: "#ffffff",
								cursor: "pointer",
								fontSize: 13
							}}
						>
							Close
						</button>
					</div>

					{/* Toolbar */}
					<div
						style={{
							padding: "12px 20px",
							borderBottom: "1px solid rgba(15,23,42,0.1)",
							display: "flex",
							gap: 8,
							alignItems: "center"
						}}
					>
						{/* Breadcrumbs */}
						<div style={{ display: "flex", gap: 4, alignItems: "center", flex: 1 }}>
							<button
								onClick={() => setCurrentFolder("")}
								style={{
									padding: "4px 8px",
									border: "none",
									background: "transparent",
									cursor: "pointer",
									fontSize: 12,
									color: currentFolderPath ? "#0a84ff" : "#334155"
								}}
							>
								Root
							</button>
							{breadcrumbs.map((crumb, i) => (
								<span key={crumb.path} style={{ display: "flex", alignItems: "center", gap: 4 }}>
									<span style={{ color: "#94a3b8" }}>/</span>
									<button
										onClick={() => setCurrentFolder(crumb.path)}
										style={{
											padding: "4px 8px",
											border: "none",
											background: "transparent",
											cursor: "pointer",
											fontSize: 12,
											color: i === breadcrumbs.length - 1 ? "#334155" : "#0a84ff"
										}}
									>
										{crumb.name}
									</button>
								</span>
							))}
						</div>
						{!creatingFolder ? (
							<button
								onClick={() => setCreatingFolder(true)}
								style={{
									padding: "6px 12px",
									border: "1px solid rgba(15,23,42,0.2)",
									borderRadius: 6,
									background: "#ffffff",
									cursor: "pointer",
									fontSize: 12
								}}
							>
								New Folder
							</button>
						) : (
							<div style={{ display: "flex", gap: 4 }}>
								<input
									ref={folderInputRef}
									type="text"
									value={newFolderName}
									onChange={(e) => setNewFolderName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") void handleCreateFolder();
										if (e.key === "Escape") {
											setCreatingFolder(false);
											setNewFolderName("");
										}
									}}
									placeholder="Folder name"
									autoFocus
									style={{
										padding: "4px 8px",
										border: "1px solid rgba(15,23,42,0.2)",
										borderRadius: 4,
										fontSize: 12,
										width: 150
									}}
								/>
								<button
									onClick={() => void handleCreateFolder()}
									style={{
										padding: "4px 8px",
										border: "1px solid #0a84ff",
										borderRadius: 4,
										background: "#0a84ff",
										color: "#ffffff",
										cursor: "pointer",
										fontSize: 12
									}}
								>
									Create
								</button>
								<button
									onClick={() => {
										setCreatingFolder(false);
										setNewFolderName("");
									}}
									style={{
										padding: "4px 8px",
										border: "1px solid rgba(15,23,42,0.2)",
										borderRadius: 4,
										background: "#ffffff",
										cursor: "pointer",
										fontSize: 12
									}}
								>
									Cancel
								</button>
							</div>
						)}
						<button
							onClick={() => void handleUploadFiles()}
							style={{
								padding: "6px 12px",
								border: "1px solid #0a84ff",
								borderRadius: 6,
								background: "#0a84ff",
								color: "#ffffff",
								cursor: "pointer",
								fontSize: 12,
								fontWeight: 500
							}}
						>
							Upload Files
						</button>
					</div>

					{/* Content Area */}
					<div style={{ flex: 1, overflow: "auto", padding: 20 }}>
						{editingNotes ? (
							<div
								style={{
									position: "absolute",
									top: "50%",
									left: "50%",
									transform: "translate(-50%, -50%)",
									background: "#ffffff",
									padding: 20,
									borderRadius: 8,
									boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
									zIndex: 3000,
									minWidth: 400
								}}
							>
								<h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600 }}>Edit Notes</h3>
								<textarea
									value={notesText}
									onChange={(e) => setNotesText(e.target.value)}
									style={{
										width: "100%",
										minHeight: 120,
										padding: 8,
										border: "1px solid rgba(15,23,42,0.2)",
										borderRadius: 4,
										fontSize: 13,
										fontFamily: "inherit",
										resize: "vertical"
									}}
									placeholder="Add notes..."
								/>
								<div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
									<button
										onClick={() => {
											setEditingNotes(null);
											setNotesText("");
										}}
										style={{
											padding: "6px 12px",
											border: "1px solid rgba(15,23,42,0.2)",
											borderRadius: 4,
											background: "#ffffff",
											cursor: "pointer",
											fontSize: 12
										}}
									>
										Cancel
									</button>
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
								</div>
							</div>
						) : null}

						{/* Folders Grid */}
						{currentFolders.length > 0 && (
							<div style={{ marginBottom: 24 }}>
								<h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#64748b" }}>Folders</h3>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
										gap: 12
									}}
								>
									{currentFolders.map((folder) => (
										<div
											key={folder.id}
											style={{
												border: "1px solid rgba(15,23,42,0.1)",
												borderRadius: 6,
												padding: 12,
												cursor: "pointer",
												background: "#ffffff",
												transition: "all 0.2s"
											}}
											onClick={() => setCurrentFolder(folder.path)}
											onMouseEnter={(e) => {
												e.currentTarget.style.background = "#f8fafc";
												e.currentTarget.style.borderColor = "#0a84ff";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background = "#ffffff";
												e.currentTarget.style.borderColor = "rgba(15,23,42,0.1)";
											}}
										>
											<div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
											<div
												style={{
													fontSize: 12,
													fontWeight: 500,
													marginBottom: 4,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap"
												}}
											>
												{folder.name}
											</div>
											<div style={{ fontSize: 10, color: "#94a3b8" }}>
												{files.filter((f) => f.path.startsWith(folder.path)).length} items
											</div>
											<div style={{ display: "flex", gap: 4, marginTop: 8 }}>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleEditNotes("folder", folder.id);
													}}
													title="Edit notes"
													style={{
														padding: "2px 6px",
														border: "none",
														background: "transparent",
														cursor: "pointer",
														fontSize: 10,
														color: "#64748b"
													}}
												>
													📝
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation();
														void handleDeleteFolder(folder.id);
													}}
													title="Delete"
													style={{
														padding: "2px 6px",
														border: "none",
														background: "transparent",
														cursor: "pointer",
														fontSize: 10,
														color: "#ef4444"
													}}
												>
													🗑️
												</button>
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Files Grid */}
						{currentFiles.length > 0 && (
							<div>
								<h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#64748b" }}>Files</h3>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
										gap: 12
									}}
								>
								{currentFiles.map((file) => {
									const mediaUrl = fileUrls[file.id] || "";
									return (
										<div
											key={file.id}
											style={{
												border: "1px solid rgba(15,23,42,0.1)",
												borderRadius: 6,
												overflow: "hidden",
												background: "#ffffff",
												cursor: "pointer",
												transition: "all 0.2s"
											}}
											onClick={() => handleFileClick(file)}
											onMouseEnter={(e) => {
												e.currentTarget.style.borderColor = "#0a84ff";
												e.currentTarget.style.boxShadow = "0 4px 12px rgba(10,132,255,0.15)";
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.borderColor = "rgba(15,23,42,0.1)";
												e.currentTarget.style.boxShadow = "none";
											}}
										>
											{file.type === "image" ? (
												<img
													src={mediaUrl}
													alt={file.name}
													style={{
														width: "100%",
														height: 120,
														objectFit: "cover",
														display: "block"
													}}
												/>
											) : (
													<div
														style={{
															width: "100%",
															height: 120,
															background: "#1e293b",
															display: "flex",
															alignItems: "center",
															justifyContent: "center",
															color: "#ffffff",
															fontSize: 32
														}}
													>
														▶
													</div>
												)}
												<div style={{ padding: 8 }}>
													<div
														style={{
															fontSize: 11,
															fontWeight: 500,
															marginBottom: 4,
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap"
														}}
													>
														{file.name}
													</div>
													<div style={{ display: "flex", gap: 4 }}>
														<button
															onClick={(e) => {
																e.stopPropagation();
																handleEditNotes("file", file.id);
															}}
															title="Edit notes"
															style={{
																padding: "2px 6px",
																border: "none",
																background: "transparent",
																cursor: "pointer",
																fontSize: 10,
																color: "#64748b"
															}}
														>
															📝
														</button>
														<button
															onClick={(e) => {
																e.stopPropagation();
																void handleDeleteFile(file.id);
															}}
															title="Delete"
															style={{
																padding: "2px 6px",
																border: "none",
																background: "transparent",
																cursor: "pointer",
																fontSize: 10,
																color: "#ef4444"
															}}
														>
															🗑️
														</button>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{currentFolders.length === 0 && currentFiles.length === 0 && (
							<div
								style={{
									textAlign: "center",
									padding: 60,
									color: "#94a3b8",
									fontSize: 14
								}}
							>
								{currentFolderPath ? "This folder is empty" : "No content yet. Upload files or create a folder."}
							</div>
						)}
					</div>
				</div>
			</div>
			<MediaViewer />
		</>
	);
}

