import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("aetherDesktop", {
  saveReviewFile: (filename, bytes, date) => ipcRenderer.invoke("review:save", { filename, bytes, date }),
  getPaths: () => ipcRenderer.invoke("desktop:paths"),
  openOutputFolder: (date) => ipcRenderer.invoke("desktop:open-output", date ?? null),
  createDesktopShortcut: () => ipcRenderer.invoke("desktop:shortcut"),
  openWorkbook: () => ipcRenderer.invoke("desktop:open-workbook"),
  saveWorkbook: (path, bytes) => ipcRenderer.invoke("desktop:save-workbook", { path, bytes }),
  saveConfig: (name, data) => ipcRenderer.invoke("desktop:save-config", name, data),
  loadConfig: (name) => ipcRenderer.invoke("desktop:load-config", name),
});
