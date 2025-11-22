/**
 * Project selection modal for web version
 */

import { useState, useEffect } from "react";
import { listLocalProjects, type LocalProject } from "../lib/storage/localProjects";

interface ProjectSelectorProps {
	onSelect: (projectId: string) => void;
	onCreateNew: (projectName: string) => Promise<void>;
	onCancel: () => void;
}

export default function ProjectSelector({ onSelect, onCreateNew, onCancel }: ProjectSelectorProps) {
	const [projects, setProjects] = useState<LocalProject[]>([]);
	const [newProjectName, setNewProjectName] = useState("");
	const [showNewForm, setShowNewForm] = useState(false);

	useEffect(() => {
		setProjects(listLocalProjects());
	}, []);

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: "rgba(0, 0, 0, 0.5)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 10000
			}}
			onClick={onCancel}
		>
			<div
				style={{
					backgroundColor: "white",
					padding: "24px",
					borderRadius: "8px",
					minWidth: "400px",
					maxWidth: "600px",
					maxHeight: "80vh",
					overflow: "auto"
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<h2 style={{ marginTop: 0 }}>Select Project</h2>
				
				{!showNewForm ? (
					<>
						{projects.length === 0 ? (
							<p>No projects found. Create a new one to get started.</p>
						) : (
							<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
								{projects.map((project) => (
									<button
										key={project.id}
										onClick={() => onSelect(project.id)}
										style={{
											padding: "12px",
											textAlign: "left",
											border: "1px solid #ccc",
											borderRadius: "4px",
											cursor: "pointer",
											backgroundColor: "white"
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor = "#f0f0f0";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor = "white";
										}}
									>
										<div style={{ fontWeight: "bold" }}>{project.name}</div>
										<div style={{ fontSize: "12px", color: "#666" }}>
											{new Date(project.updatedAt).toLocaleString()}
										</div>
									</button>
								))}
							</div>
						)}
						
						<div style={{ display: "flex", gap: "8px" }}>
							<button
								onClick={() => setShowNewForm(true)}
								style={{
									padding: "8px 16px",
									backgroundColor: "#4CAF50",
									color: "white",
									border: "none",
									borderRadius: "4px",
									cursor: "pointer"
								}}
							>
								Create New Project
							</button>
							<button
								onClick={onCancel}
								style={{
									padding: "8px 16px",
									backgroundColor: "#ccc",
									color: "black",
									border: "none",
									borderRadius: "4px",
									cursor: "pointer"
								}}
							>
								Cancel
							</button>
						</div>
					</>
				) : (
					<>
						<div style={{ marginBottom: "16px" }}>
							<label style={{ display: "block", marginBottom: "8px" }}>Project Name:</label>
							<input
								type="text"
								value={newProjectName}
								onChange={(e) => setNewProjectName(e.target.value)}
								style={{
									width: "100%",
									padding: "8px",
									border: "1px solid #ccc",
									borderRadius: "4px",
									boxSizing: "border-box"
								}}
								placeholder="Enter project name"
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Enter" && newProjectName.trim()) {
										onCreateNew();
									}
								}}
							/>
						</div>
						<div style={{ display: "flex", gap: "8px" }}>
							<button
								onClick={() => {
									if (newProjectName.trim()) {
										onCreateNew(newProjectName.trim());
									}
								}}
								disabled={!newProjectName.trim()}
								style={{
									padding: "8px 16px",
									backgroundColor: newProjectName.trim() ? "#4CAF50" : "#ccc",
									color: "white",
									border: "none",
									borderRadius: "4px",
									cursor: newProjectName.trim() ? "pointer" : "not-allowed"
								}}
							>
								Create
							</button>
							<button
								onClick={() => {
									setShowNewForm(false);
									setNewProjectName("");
								}}
								style={{
									padding: "8px 16px",
									backgroundColor: "#ccc",
									color: "black",
									border: "none",
									borderRadius: "4px",
									cursor: "pointer"
								}}
							>
								Back
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

