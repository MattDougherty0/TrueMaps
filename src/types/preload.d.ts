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
			atomicWriteTextFile: (baseDir: string, relativePath: string, content: string) => Promise<boolean>;
			writeBinaryFile: (
				baseDir: string,
				relativePath: string,
				base64Data: string
			) => Promise<boolean>;
			copyToMedia: (baseDir: string, sourceAbsolutePath: string, targetFolderPath?: string) => Promise<string>;
			resolveMediaPath: (baseDir: string, relativePath: string) => Promise<string>;
			hashMediaFiles: (baseDir: string, mediaPaths: string[]) => Promise<Array<{ path: string; sha256: string }>>;
			deleteFile: (absolutePath: string) => Promise<boolean>;
			listMediaFolder: (baseDir: string, relativeFolderPath: string) => Promise<string[]>;
			importMediaFolder: (
				baseDir: string,
				sourceDirAbsolutePath: string,
				targetFolderPath: string
			) => Promise<{ folder: string; files: string[] }>;
			importTrailCameraMedia: (
				baseDir: string,
				sourceDirAbsolutePath: string,
				targetFolderPath: string,
				knownHashes: string[]
			) => Promise<{
				files: Array<{
					name: string;
					path: string;
					type: "image" | "video";
					sha256: string;
					size: number;
					capturedAt: string;
				}>;
				skippedDuplicates: number;
				skippedUnsupported: number;
				failedFiles: string[];
			}>;
			onTrailCameraImportProgress: (
				listener: (progress: { processed: number; total: number; fileName: string; stage: string }) => void
			) => () => void;
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
			openPath?: (absolutePath: string) => Promise<boolean>;
		};
	}
}


