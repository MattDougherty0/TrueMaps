"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("env", {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
});
electron_1.contextBridge.exposeInMainWorld("api", {
    chooseDirectory: () => electron_1.ipcRenderer.invoke("dialog:chooseDirectory"),
    readTextFile: (baseDir, relativePath) => electron_1.ipcRenderer.invoke("fs:readTextFile", baseDir, relativePath),
    writeTextFile: (baseDir, relativePath, content) => electron_1.ipcRenderer.invoke("fs:writeTextFile", baseDir, relativePath, content),
    atomicWriteTextFile: (baseDir, relativePath, content) => electron_1.ipcRenderer.invoke("fs:atomicWriteTextFile", baseDir, relativePath, content),
    writeBinaryFile: (baseDir, relativePath, base64Data) => electron_1.ipcRenderer.invoke("fs:writeBinaryFile", baseDir, relativePath, base64Data),
    copyToMedia: (baseDir, sourceAbsolutePath, targetFolderPath) => electron_1.ipcRenderer.invoke("media:copy", baseDir, sourceAbsolutePath, targetFolderPath),
    resolveMediaPath: (baseDir, relativePath) => electron_1.ipcRenderer.invoke("media:resolvePath", baseDir, relativePath),
    deleteFile: (absolutePath) => electron_1.ipcRenderer.invoke("media:deleteFile", absolutePath),
    projectCreateStructure: (baseDir, projectName) => electron_1.ipcRenderer.invoke("project:createStructure", baseDir, projectName),
    chooseFile: (filters) => electron_1.ipcRenderer.invoke("dialog:chooseFile", { filters }),
    chooseFiles: (filters) => electron_1.ipcRenderer.invoke("dialog:chooseFiles", { filters }),
    readExternalFile: (absolutePath) => electron_1.ipcRenderer.invoke("fs:readExternalFile", absolutePath),
    setActiveProject: (baseDir) => {
        electron_1.ipcRenderer.send("project:setActivePath", baseDir);
    },
    printPdf: (baseDir, payload) => electron_1.ipcRenderer.invoke("print:pdf", baseDir, payload),
    exportGeoPackage: (baseDir) => electron_1.ipcRenderer.invoke("export:gpkg", baseDir),
    openPath: (absolutePath) => electron_1.ipcRenderer.invoke("os:openPath", absolutePath)
});
