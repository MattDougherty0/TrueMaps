export {};

declare global {
	interface Window {
		env: {
			node: string;
			chrome: string;
			electron: string;
		};
		api: {
			chooseDirectory: () => Promise<string | null>;
			readTextFile: (baseDir: string, relativePath: string) => Promise<string>;
			writeTextFile: (baseDir: string, relativePath: string, content: string) => Promise<boolean>;
			writeBinaryFile: (
				baseDir: string,
				relativePath: string,
				base64Data: string
			) => Promise<boolean>;
			copyToMedia: (baseDir: string, sourceAbsolutePath: string, targetFolderPath?: string) => Promise<string>;
			resolveMediaPath: (baseDir: string, relativePath: string) => Promise<string>;
			deleteFile: (absolutePath: string) => Promise<boolean>;
			projectCreateStructure: (baseDir: string, projectName: string) => Promise<boolean>;
			chooseFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
			chooseFiles: (filters?: { name: string; extensions: string[] }[]) => Promise<string[]>;
			readExternalFile: (absolutePath: string) => Promise<string>;
			setActiveProject: (baseDir: string) => void;
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
			) => Promise<string>;
			exportGeoPackage: (baseDir: string) => Promise<string | null>;
		};
	}
}


