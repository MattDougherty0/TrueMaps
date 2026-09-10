import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initColorScheme } from "./state/appearance";

initColorScheme();

const container = document.getElementById("root");
if (container) {
	const root = createRoot(container);
	root.render(
		<React.StrictMode>
			<App />
		</React.StrictMode>
	);
}

