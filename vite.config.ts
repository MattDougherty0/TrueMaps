import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";
import path from "node:path";

export default defineConfig({
	plugins: [react(), cesium()],
	define: {
		CESIUM_BASE_URL: JSON.stringify("/cesium")
	},
	resolve: {
		alias: {
			react: path.resolve(__dirname, "node_modules/react"),
			"react-dom": path.resolve(__dirname, "node_modules/react-dom")
		}
	},
	build: {
		outDir: "dist"
	},
	server: {
		port: 5173,
		strictPort: true
	}
});

