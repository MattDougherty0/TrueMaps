/**
 * Local project storage using localStorage and IndexedDB
 */

export interface LocalProject {
	id: string;
	name: string;
	updatedAt: string;
}

const STORAGE_KEY = "huntmaps-projects";

export function listLocalProjects(): LocalProject[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		return JSON.parse(stored) as LocalProject[];
	} catch {
		return [];
	}
}

export function addLocalProject(project: LocalProject): void {
	const projects = listLocalProjects();
	if (!projects.find(p => p.id === project.id)) {
		projects.push(project);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
	}
}

export function updateLocalProject(id: string, updates: Partial<LocalProject>): void {
	const projects = listLocalProjects();
	const index = projects.findIndex(p => p.id === id);
	if (index >= 0) {
		projects[index] = { ...projects[index], ...updates };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
	}
}

export function deleteLocalProject(id: string): void {
	const projects = listLocalProjects();
	const filtered = projects.filter(p => p.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getLocalProject(id: string): LocalProject | null {
	const projects = listLocalProjects();
	return projects.find(p => p.id === id) || null;
}

