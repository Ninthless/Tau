import { contextBridge, ipcRenderer } from "electron"
import type { ThinkingLevel } from "../src/types"

contextBridge.exposeInMainWorld("piAgent", {
  prompt: (text: string, images?: unknown[]) =>
    ipcRenderer.invoke("agent:prompt", { text, images }),
  steer: (text: string) => ipcRenderer.invoke("agent:steer", { text }),
  followUp: (text: string) => ipcRenderer.invoke("agent:followUp", { text }),
  abort: () => ipcRenderer.invoke("agent:abort"),
  compact: (instructions?: string) => ipcRenderer.invoke("agent:compact", { instructions }),
  navigateTree: (targetId: string) => ipcRenderer.invoke("agent:navigateTree", { targetId }),
  setSessionName: (name: string) => ipcRenderer.invoke("agent:setSessionName", { name }),
  getSessionStats: () => ipcRenderer.invoke("agent:getSessionStats"),
  getSessionTree: () => ipcRenderer.invoke("agent:getSessionTree"),
  getMessages: () => ipcRenderer.invoke("agent:getMessages"),
  exportSessionHtml: () => ipcRenderer.invoke("agent:exportSessionHtml"),
  reloadSession: () => ipcRenderer.invoke("agent:reloadSession"),
  newSession: (cwd: string) => ipcRenderer.invoke("agent:newSession", { cwd }),
  switchSession: (path: string) => ipcRenderer.invoke("agent:switchSession", { path }),
  fork: (entryId: string) => ipcRenderer.invoke("agent:fork", { entryId }),
  listSessions: (cwd: string) => ipcRenderer.invoke("agent:listSessions", { cwd }),
  listAllSessions: () => ipcRenderer.invoke("agent:listAllSessions"),
  deleteSession: (path: string) => ipcRenderer.invoke("agent:deleteSession", { path }),
  selectDirectory: () => ipcRenderer.invoke("app:selectDirectory"),
  setModel: (provider: string, modelId: string) =>
    ipcRenderer.invoke("agent:setModel", { provider, modelId }) as Promise<{ ok: boolean }>,
  getModels: () => ipcRenderer.invoke("agent:getModels"),
  getAuthProviders: () => ipcRenderer.invoke("agent:getAuthProviders"),
  setThinkingLevel: (level: ThinkingLevel) =>
    ipcRenderer.invoke("agent:setThinkingLevel", { level }),
  cycleThinkingLevel: () => ipcRenderer.invoke("agent:cycleThinkingLevel"),
  getState: () => ipcRenderer.invoke("agent:getState"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings: unknown) => ipcRenderer.invoke("settings:set", settings),
  setApiKey: (provider: string, key: string) =>
    ipcRenderer.invoke("agent:setApiKey", { provider, key }),
  getTools: () => ipcRenderer.invoke("agent:getTools"),
  setActiveTools: (toolNames: string[]) => ipcRenderer.invoke("agent:setActiveTools", { toolNames }),
  getRuntimeSettings: () => ipcRenderer.invoke("agent:getRuntimeSettings"),
  setRuntimeSettings: (settings: unknown) => ipcRenderer.invoke("agent:setRuntimeSettings", settings),
  getPackages: () => ipcRenderer.invoke("agent:getPackages"),
  installPackage: (source: string, local?: boolean) =>
    ipcRenderer.invoke("agent:installPackage", { source, local }),
  removePackage: (source: string, local?: boolean) =>
    ipcRenderer.invoke("agent:removePackage", { source, local }),
  updatePackage: (source?: string) => ipcRenderer.invoke("agent:updatePackage", { source }),
  searchPackageGallery: (query: string, page?: number, type?: string, sort?: string) =>
    ipcRenderer.invoke("agent:searchPackageGallery", { query, page, type, sort }),

  onEvent: (cb: (event: unknown) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: unknown) => cb(event)
    ipcRenderer.on("agent:event", listener)
    return () => ipcRenderer.removeListener("agent:event", listener)
  },

  onStateChange: (cb: (state: unknown) => void) => {
    const listener = (_: Electron.IpcRendererEvent, state: unknown) => cb(state)
    ipcRenderer.on("agent:stateChange", listener)
    return () => ipcRenderer.removeListener("agent:stateChange", listener)
  },

  onPackageProgress: (cb: (event: unknown) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: unknown) => cb(event)
    ipcRenderer.on("package:progress", listener)
    return () => ipcRenderer.removeListener("package:progress", listener)
  },
})

contextBridge.exposeInMainWorld("winControls", {
  minimize: () => ipcRenderer.invoke("win:minimize"),
  maximize: () => ipcRenderer.invoke("win:maximize"),
  close: () => ipcRenderer.invoke("win:close"),
  isMaximized: () => ipcRenderer.invoke("win:isMaximized") as Promise<boolean>,
  onMaximizeChange: (cb: (isMaximized: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, value: boolean) => cb(value)
    ipcRenderer.on("win:maximizeChange", listener)
    return () => ipcRenderer.removeListener("win:maximizeChange", listener)
  },
})
