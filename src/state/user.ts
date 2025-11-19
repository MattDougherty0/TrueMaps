import { create } from "zustand";
import useAppStore from "./store";

type UserState = {
	activeUser: string | null;
	users: string[];
	loadUsers: () => Promise<void>;
	setActiveUser: (name: string | null) => Promise<void>;
	addUser: (name: string) => Promise<void>;
};

export const useUserStore = create<UserState>((set, get) => ({
	activeUser: null,
	users: [],
	loadUsers: async () => {
		try {
			const baseDir = (useAppStore.getState?.() as any)?.projectPath as string | null;
			if (!baseDir) return;
			const text = await window.api.readTextFile(baseDir, "project.json");
			const pj = JSON.parse(text || "{}");
			const users = Array.isArray(pj.users) ? pj.users.filter((u: unknown) => typeof u === "string") : [];
			set({ users });
		} catch {
			set({ users: [] });
		}
	},
	setActiveUser: async (name) => {
		const baseDir = (useAppStore.getState?.() as any)?.projectPath as string | null;
		if (!baseDir) {
			set({ activeUser: name || null });
			(window as any).__ACTIVE_USER__ = name || undefined;
			return;
		}
		try {
			const text = await window.api.readTextFile(baseDir, "project.json");
			const pj = JSON.parse(text || "{}");
			const users = Array.isArray(pj.users) ? pj.users : [];
			if (name && !users.includes(name)) users.push(name);
			pj.users = users;
			await window.api.writeTextFile(baseDir, "project.json", JSON.stringify(pj, null, 2));
		} catch {
			// ignore write errors for now
		}
		set({ activeUser: name || null });
		(window as any).__ACTIVE_USER__ = name || undefined;
	},
	addUser: async (name) => {
		const baseDir = (useUserStore.getState?.() as any)?.projectPath as string | null;
		try {
			const dir = (useAppStore.getState?.() as any)?.projectPath as string | null;
			if (!dir) return;
			const text = await window.api.readTextFile(dir, "project.json");
			const pj = JSON.parse(text || "{}");
			const users = Array.isArray(pj.users) ? pj.users : [];
			if (!users.includes(name)) users.push(name);
			pj.users = users;
			await window.api.writeTextFile(dir, "project.json", JSON.stringify(pj, null, 2));
			// refresh local state
			get().loadUsers();
		} catch {
			// ignore
		}
	}
}));


