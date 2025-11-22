/**
 * Platform abstraction layer
 * Exports a unified API for both Electron and Web platforms
 */

export interface PlatformAPI {
	chooseDirectory(): Promise<string | null>;
	chooseFile(filters?: { name: string; extensions: string[] }[]): Promise<string | null>;
	chooseFiles(filters?: { name: string; extensions: string[] }[]): Promise<string[]>;
	readTextFile(baseDir: string, relativePath: string): Promise<string>;
	writeTextFile(baseDir: string, relativePath: string, content: string): Promise<boolean>;
	atomicWriteTextFile(baseDir: string, relativePath: string, content: string): Promise<boolean>;
	writeBinaryFile(baseDir: string, relativePath: string, base64Data: string): Promise<boolean>;
	readExternalFile(absolutePath: string): Promise<string>;
	copyToMedia(baseDir: string, sourceAbsolutePath: string, targetFolderPath?: string): Promise<string>;
	resolveMediaPath(baseDir: string, relativePath: string): Promise<string>;
	deleteFile(absolutePath: string): Promise<boolean>;
	projectCreateStructure(baseDir: string, projectName: string): Promise<boolean>;
	setActiveProject(baseDir: string): void;
	printPdf?(baseDir: string, payload: any): Promise<string | null>;
	exportGeoPackage?(baseDir: string): Promise<string | null>;
	openPath?: (absolutePath: string) => Promise<boolean>;
}

export const isElectron = (): boolean => {
	return typeof window !== "undefined" && 
		typeof (window as any).process !== "undefined" && 
		(window as any).process.type === "renderer";
};

// Import web implementation
import { webAPI } from "./web";

// Get the appropriate API - in Electron, window.api is set by preload.ts
// In web, we set it ourselves
const getPlatformAPI = (): PlatformAPI => {
	if (typeof window !== "undefined") {
		// In Electron, window.api is already set by preload.ts (read-only)
		if ((window as any).api) {
			return (window as any).api as PlatformAPI;
		}
		// In web, set it ourselves
		(window as any).api = webAPI as any;
		return webAPI;
	}
	return webAPI;
};

// Export the platform API
export const platformAPI: PlatformAPI = getPlatformAPI();

