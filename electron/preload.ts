import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("env", {
	node: process.versions.node,
	chrome: process.versions.chrome,
	electron: process.versions.electron
});

contextBridge.exposeInMainWorld("api", {
	chooseDirectory: (): Promise<string | null> => ipcRenderer.invoke("dialog:chooseDirectory"),
	readTextFile: (baseDir: string, relativePath: string): Promise<string> =>
		ipcRenderer.invoke("fs:readTextFile", baseDir, relativePath),
	writeTextFile: (baseDir: string, relativePath: string, content: string): Promise<boolean> =>
		ipcRenderer.invoke("fs:writeTextFile", baseDir, relativePath, content),
		atomicWriteTextFile: (
			baseDir: string,
			relativePath: string,
			content: string
		): Promise<boolean> => ipcRenderer.invoke("fs:atomicWriteTextFile", baseDir, relativePath, content),
	writeBinaryFile: (
		baseDir: string,
		relativePath: string,
		base64Data: string
	): Promise<boolean> => ipcRenderer.invoke("fs:writeBinaryFile", baseDir, relativePath, base64Data),
	copyToMedia: (baseDir: string, sourceAbsolutePath: string, targetFolderPath?: string): Promise<string> =>
		ipcRenderer.invoke("media:copy", baseDir, sourceAbsolutePath, targetFolderPath),
	resolveMediaPath: (baseDir: string, relativePath: string): Promise<string> =>
		ipcRenderer.invoke("media:resolvePath", baseDir, relativePath),
	deleteFile: (absolutePath: string): Promise<boolean> =>
		ipcRenderer.invoke("media:deleteFile", absolutePath),
	projectCreateStructure: (baseDir: string, projectName: string): Promise<boolean> =>
		ipcRenderer.invoke("project:createStructure", baseDir, projectName),
	chooseFile: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
		ipcRenderer.invoke("dialog:chooseFile", { filters }),
	chooseFiles: (filters?: { name: string; extensions: string[] }[]): Promise<string[]> =>
		ipcRenderer.invoke("dialog:chooseFiles", { filters }),
	readExternalFile: (absolutePath: string): Promise<string> =>
		ipcRenderer.invoke("fs:readExternalFile", absolutePath),
	setActiveProject: (baseDir: string): void => {
		ipcRenderer.send("project:setActivePath", baseDir);
	},
	printPdf: (
		baseDir: string,
		payload: {
			imageBase64: string;
			imageWidth: number;
			imageHeight: number;
			preset: string;
			timeWindow: string;
			scaleMeters: number;
			scaleLabel: string;
			timestamp: string;
		}
	): Promise<string> => ipcRenderer.invoke("print:pdf", baseDir, payload),
	exportGeoPackage: (baseDir: string): Promise<string | null> =>
		ipcRenderer.invoke("export:gpkg", baseDir),
	openPath: (absolutePath: string): Promise<boolean> => ipcRenderer.invoke("os:openPath", absolutePath)
});


