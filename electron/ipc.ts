import { BrowserWindow, dialog, ipcMain } from "electron"
import Store from "electron-store"
import * as agent from "./agent"
import type { AppSettings, ThinkingLevel } from "../src/types"

const KEY_PROVIDERS = [
  "anthropic", "azure-openai-responses", "cerebras", "cloudflare-ai-gateway",
  "cloudflare-workers-ai", "deepseek", "fireworks", "google", "groq", "huggingface",
  "kimi-coding", "minimax", "minimax-cn", "mistral", "moonshotai", "moonshotai-cn",
  "ollama", "opencode", "opencode-go", "openai", "openrouter", "together",
  "vercel-ai-gateway", "xai", "xiaomi", "xiaomi-token-plan-ams",
  "xiaomi-token-plan-cn", "xiaomi-token-plan-sgp", "zai",
]

const store = new Store<{ settings: Omit<AppSettings, "apiKeys"> }>({
  defaults: { settings: { defaultCwd: process.cwd() } },
})

export function registerIpcHandlers() {
  ipcMain.handle("agent:prompt", (_e, { text, images }) => agent.prompt(text, images))
  ipcMain.handle("agent:steer", (_e, { text }) => agent.steer(text))
  ipcMain.handle("agent:followUp", (_e, { text }) => agent.followUp(text))
  ipcMain.handle("agent:abort", () => agent.abort())
  ipcMain.handle("agent:compact", (_e, { instructions }) => agent.compact(instructions))
  ipcMain.handle("agent:navigateTree", (_e, { targetId }) => agent.navigateTree(targetId))
  ipcMain.handle("agent:setSessionName", (_e, { name }) => agent.setSessionName(name))
  ipcMain.handle("agent:getSessionStats", () => agent.getSessionStats())
  ipcMain.handle("agent:getSessionTree", () => agent.getSessionTree())
  ipcMain.handle("agent:getMessages", () => agent.getMessages())
  ipcMain.handle("agent:exportSessionHtml", () => agent.exportSessionHtml())
  ipcMain.handle("agent:reloadSession", () => agent.reloadSession())
  ipcMain.handle("agent:newSession", (_e, { cwd }) => agent.newSession(cwd))
  ipcMain.handle("agent:switchSession", (_e, { path }) => agent.switchSession(path))
  ipcMain.handle("agent:fork", (_e, { entryId }) => agent.fork(entryId))
  ipcMain.handle("agent:listSessions", (_e, { cwd }) => agent.listSessions(cwd))
  ipcMain.handle("agent:listAllSessions", () => agent.listAllSessions())
  ipcMain.handle("agent:deleteSession", (_e, { path }) => agent.deleteSession(path))
  ipcMain.handle("app:selectDirectory", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ["openDirectory"] })
      : await dialog.showOpenDialog({ properties: ["openDirectory"] })
    return result.canceled ? null : result.filePaths[0] ?? null
  })
  ipcMain.handle("agent:setModel", async (_e, { provider, modelId }) => {
    const ok = await agent.setModel(provider, modelId)
    return { ok }
  })
  ipcMain.handle("agent:getModels", () => agent.getModels())
  ipcMain.handle("agent:getAuthProviders", () => agent.getAuthProviders())
  ipcMain.handle("agent:setThinkingLevel", (_e, { level }) => agent.setThinkingLevel(level as ThinkingLevel))
  ipcMain.handle("agent:cycleThinkingLevel", () => agent.cycleThinkingLevel())
  ipcMain.handle("agent:getState", () => agent.getState())
  ipcMain.handle("agent:setApiKey", (_e, { provider, key }) => agent.setApiKey(provider, key))
  ipcMain.handle("agent:getTools", () => agent.getTools())
  ipcMain.handle("agent:setActiveTools", (_e, { toolNames }) => agent.setActiveTools(toolNames))
  ipcMain.handle("agent:getRuntimeSettings", () => agent.getRuntimeSettings())
  ipcMain.handle("agent:setRuntimeSettings", (_e, partial) => agent.setRuntimeSettings(partial))
  ipcMain.handle("agent:getPackages", () => agent.getPackages())
  ipcMain.handle("agent:installPackage", (_e, { source, local }) => agent.installPackage(source, local))
  ipcMain.handle("agent:removePackage", (_e, { source, local }) => agent.removePackage(source, local))
  ipcMain.handle("agent:updatePackage", (_e, { source }) => agent.updatePackage(source))
  ipcMain.handle("agent:searchPackageGallery", (_e, { query, page, type, sort }) => agent.searchPackageGallery(query, page, type, sort))

  ipcMain.handle("settings:get", () => {
    const s = store.get("settings")
    const apiKeys = agent.getApiKeys(KEY_PROVIDERS)
    return { ...s, apiKeys }
  })

  ipcMain.handle("settings:set", (_e, partial: Partial<Omit<AppSettings, "apiKeys">>) => {
    const current = store.get("settings")
    store.set("settings", { ...current, ...partial })
  })

  ipcMain.handle("win:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle("win:maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.handle("win:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle("win:isMaximized", (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
}
