import { useEffect } from "react";
import AppShell from "./components/AppShell";
import useAppStore from "./state/store";
import { isElectron } from "./lib/platform";

export default function App() {
	useEffect(() => {
		const path = import.meta.env.VITE_DEV_PROJECT_PATH;
		if (!import.meta.env.DEV || !path || !isElectron()) return;
		if (useAppStore.getState().projectPath) return;
		void useAppStore.getState().openProjectAt(path);
	}, []);

	return <AppShell />;
}
