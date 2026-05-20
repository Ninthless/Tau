import { AuthStorage, DefaultPackageManager, ModelRegistry, SessionManager, SettingsManager, getAgentDir } from "@earendil-works/pi-coding-agent"
import type { BrowserWindow } from "electron"
import type { AgentState, AppSettings, AuthProviderInfo, AvailableModel, ChatMessage, MessageBlock, PiPackageGalleryItem, PiPackageGalleryResult, PiPackageGallerySort, PiPackageGalleryType, PiPackageInfo, RuntimeSettings, SessionInfo, SessionStats, SessionTreeItem, ThinkingLevel, ToolInfo } from "../src/types"
import { rpc } from "./rpc"

let win: BrowserWindow | null = null
const authStorage = AuthStorage.create()
const modelRegistry = ModelRegistry.create(authStorage)
let settingsManager = SettingsManager.create(process.cwd(), getAgentDir())

function packageManager() {
  const manager = new DefaultPackageManager({
    cwd: rpc.getCwd(),
    agentDir: getAgentDir(),
    settingsManager,
  })
  manager.setProgressCallback((event) => {
    win?.webContents.send("package:progress", event)
  })
  return manager
}

async function reloadSettings() {
  await settingsManager.reload().catch(() => {})
}

export function setWindow(w: BrowserWindow) {
  win = w
  rpc.setWindow(w)
}

export async function initAgent(cwd: string) {
  settingsManager = SettingsManager.create(cwd, getAgentDir())
  await rpc.start(cwd)
  const state = await rpc.sendCommand({ type: "get_state" }).catch(() => null)
  if (state && win) {
    win.webContents.send("agent:stateChange", normalizeState(state))
  }
}

function normalizeState(raw: unknown): AgentState {
  const s = raw as Record<string, unknown>
  const model = s["model"] as Record<string, unknown> | undefined
  const queue = rpc.getQueueSummary()
  return {
    isStreaming: (s["isStreaming"] as boolean) ?? false,
    sessionId: (s["sessionId"] as string) ?? "",
    thinkingLevel: (s["thinkingLevel"] as ThinkingLevel) ?? "low",
    model: model ? { id: model["id"] as string, provider: model["provider"] as string, name: (model["name"] ?? model["id"]) as string } : undefined,
    queuedSteering: queue.queuedSteering ?? ((s["pendingMessageCount"] as number) > 0 ? "queued" : null),
    queuedFollowUp: queue.queuedFollowUp,
    isRetrying: (s["isRetrying"] as boolean) ?? false,
    isCompacting: (s["isCompacting"] as boolean) ?? false,
  }
}

export async function prompt(text: string, images?: unknown[]) {
  const state = await rpc.sendCommand({ type: "get_state" }).catch(() => null) as Record<string, unknown> | null
  const msg: Record<string, unknown> = { type: "prompt", message: text }
  if (state?.["isStreaming"]) msg["streamingBehavior"] = "followUp"
  if (images?.length) msg["images"] = images
  await rpc.sendCommand(msg)
}

export async function steer(text: string, images?: unknown[]) {
  const msg: Record<string, unknown> = { type: "steer", message: text }
  if (images?.length) msg["images"] = images
  await rpc.sendCommand(msg)
}

export async function followUp(text: string, images?: unknown[]) {
  const msg: Record<string, unknown> = { type: "follow_up", message: text }
  if (images?.length) msg["images"] = images
  await rpc.sendCommand(msg)
}

export async function abort() {
  await rpc.sendCommand({ type: "abort" })
}

export async function compact(instructions?: string) {
  const msg: Record<string, unknown> = { type: "compact" }
  if (instructions) msg["customInstructions"] = instructions
  await rpc.sendCommand(msg)
}

export async function navigateTree(targetId: string) {
  await rpc.sendCommand({ type: "fork", entryId: targetId })
  await emitState()
}

export async function setSessionName(name: string) {
  await rpc.sendCommand({ type: "set_session_name", name })
  await emitState()
}

export async function getSessionStats(): Promise<SessionStats | null> {
  try {
    const raw = await rpc.sendCommand({ type: "get_session_stats" }) as Record<string, unknown>
    const state = await rpc.sendCommand({ type: "get_state" }).catch(() => null) as Record<string, unknown> | null
    const tokens = raw["tokens"] as Record<string, unknown> | undefined
    return {
      sessionFile: raw["sessionFile"] as string | undefined,
      sessionId: raw["sessionId"] as string ?? "",
      sessionName: state?.["sessionName"] as string | undefined,
      userMessages: (raw["userMessages"] as number) ?? 0,
      assistantMessages: (raw["assistantMessages"] as number) ?? 0,
      toolCalls: (raw["toolCalls"] as number) ?? 0,
      toolResults: (raw["toolResults"] as number) ?? 0,
      totalMessages: (raw["totalMessages"] as number) ?? 0,
      tokens: {
        input: (tokens?.["input"] as number) ?? 0,
        output: (tokens?.["output"] as number) ?? 0,
        cacheRead: (tokens?.["cacheRead"] as number) ?? 0,
        cacheWrite: (tokens?.["cacheWrite"] as number) ?? 0,
        total: (tokens?.["total"] as number) ?? 0,
      },
      cost: (raw["cost"] as number) ?? 0,
    }
  } catch {
    return null
  }
}

function blocksFromRpcMessage(msg: Record<string, unknown>): MessageBlock[] {
  const content = msg["content"]
  if (typeof content === "string") return [{ type: "text", text: content }]
  if (!Array.isArray(content)) return []
  const blocks: MessageBlock[] = []
  for (const part of content) {
    const p = part as Record<string, unknown>
    if (p["type"] === "text") {
      blocks.push({ type: "text", text: (p["text"] as string) ?? "" })
    } else if (p["type"] === "image") {
      blocks.push({ type: "image", data: (p["data"] as string) ?? "", mimeType: (p["mimeType"] as string) ?? "image/png" })
    } else if (p["type"] === "thinking") {
      blocks.push({ type: "thinking", text: (p["thinking"] as string) ?? "", collapsed: true })
    } else if (p["type"] === "toolCall") {
      blocks.push({
        type: "tool_call",
        toolCallId: (p["id"] as string) ?? "",
        toolName: (p["name"] as string) ?? "tool",
        label: (p["name"] as string) ?? "tool",
        args: (p["arguments"] as Record<string, unknown>) ?? {},
        status: "done",
        collapsed: true,
      })
    }
  }
  return blocks
}

export async function getMessages(): Promise<ChatMessage[]> {
  try {
    const raw = await rpc.sendCommand({ type: "get_messages" }) as Record<string, unknown>
    const msgs = raw["messages"] as unknown[]
    if (!Array.isArray(msgs)) return []
    const result: ChatMessage[] = []
    for (const m of msgs) {
      const msg = m as Record<string, unknown>
      const role = msg["role"] as string
      if (role !== "user" && role !== "assistant") continue
      result.push({
        id: (msg["id"] as string) ?? String(result.length),
        role: role as "user" | "assistant",
        blocks: blocksFromRpcMessage(msg),
      })
    }
    return result
  } catch {
    return []
  }
}

export async function getSessionTree(): Promise<SessionTreeItem[]> {
  try {
    const raw = await rpc.sendCommand({ type: "get_fork_messages" }) as Record<string, unknown>
    const messages = raw["messages"] as unknown[]
    if (!Array.isArray(messages)) return []
    return messages.map((item, index) => {
      const msg = item as Record<string, unknown>
      return {
        id: (msg["entryId"] as string) ?? String(index),
        parentId: null,
        type: "fork",
        role: "user",
        title: (msg["text"] as string) ?? "",
        timestamp: "",
        depth: 0,
        active: false,
      }
    })
  } catch {
    return []
  }
}

export async function exportSessionHtml(): Promise<string> {
  const raw = await rpc.sendCommand({ type: "export_html" }) as Record<string, unknown>
  return (raw["path"] as string) ?? ""
}

export async function reloadSession() {
  const cwd = rpc.getCwd()
  settingsManager = SettingsManager.create(cwd, getAgentDir())
  await rpc.restart(cwd)
  await emitState()
}

export async function newSession(cwd: string) {
  if (cwd && cwd !== rpc.getCwd()) {
    settingsManager = SettingsManager.create(cwd, getAgentDir())
    await rpc.restart(cwd)
  }
  await rpc.sendCommand({ type: "new_session" })
  await emitState()
}

export async function switchSession(path: string) {
  await rpc.sendCommand({ type: "switch_session", sessionPath: path })
  await emitState()
}

export async function fork(entryId: string) {
  await rpc.sendCommand({ type: "fork", entryId })
  await emitState()
}

export async function listSessions(cwd: string): Promise<SessionInfo[]> {
  try {
    const results = await SessionManager.list(cwd)
    return results.map(mapSessionInfo)
  } catch {
    return []
  }
}

export async function listAllSessions(): Promise<SessionInfo[]> {
  try {
    const results = await SessionManager.listAll()
    return results.map(mapSessionInfo)
  } catch {
    return []
  }
}

export async function deleteSession(path: string): Promise<void> {
  const { unlink } = await import("node:fs/promises")
  await unlink(path)
}

function mapSessionInfo(r: {
  path: string
  id: string
  cwd: string
  created: Date
  modified: Date
  messageCount: number
  firstMessage: string
}) {
  return {
    path: r.path,
    id: r.id,
    cwd: r.cwd,
    created: r.created instanceof Date ? r.created.toISOString() : String(r.created),
    modified: r.modified instanceof Date ? r.modified.toISOString() : String(r.modified),
    messageCount: r.messageCount,
    firstMessage: r.firstMessage ?? "",
  }
}

export async function setModel(provider: string, modelId: string): Promise<boolean> {
  try {
    await rpc.sendCommand({ type: "set_model", provider, modelId })
    return true
  } catch {
    return false
  }
}

export async function getModels(): Promise<AvailableModel[]> {
  try {
    modelRegistry.refresh()
    const raw = await rpc.sendCommand({ type: "get_available_models" }) as Record<string, unknown>
    const models = raw["models"] as unknown[]
    if (!Array.isArray(models)) return []
    const stateRaw = await rpc.sendCommand({ type: "get_state" }).catch(() => null) as Record<string, unknown> | null
    const currentModel = stateRaw?.["model"] as Record<string, unknown> | undefined
    return models.map((m) => {
      const model = m as Record<string, unknown>
      const provider = model["provider"] as string
      const id = model["id"] as string
      const status = modelRegistry.getProviderAuthStatus(provider)
      const hasAuth = status.configured || status.source !== undefined || modelRegistry.hasConfiguredAuth(m as never)
      return {
        id,
        name: (model["name"] as string) ?? id,
        provider,
        providerName: modelRegistry.getProviderDisplayName(provider),
        reasoning: (model["reasoning"] as boolean) ?? false,
        contextWindow: (model["contextWindow"] as number) ?? 0,
        hasAuth,
        authSource: status.source,
        authLabel: status.label,
        current: currentModel?.["provider"] === provider && currentModel?.["id"] === id,
        default: false,
      }
    })
  } catch {
    return []
  }
}

export function getAuthProviders(): AuthProviderInfo[] {
  modelRegistry.refresh()
  const oauthProviders = authStorage.getOAuthProviders()
  const oauthIds = new Set(oauthProviders.map((p) => p.id))
  const providers: AuthProviderInfo[] = []

  for (const p of oauthProviders) {
    const cred = authStorage.get(p.id)
    const status = modelRegistry.getProviderAuthStatus(p.id)
    providers.push({
      id: p.id,
      name: p.name,
      authType: "oauth",
      configured: cred?.type === "oauth",
      source: status.source,
      label: status.label,
      storedType: cred?.type,
    })
  }

  const modelProviders = new Set(modelRegistry.getAll().map((m) => m.provider))
  for (const provider of modelProviders) {
    if (oauthIds.has(provider)) continue
    const cred = authStorage.get(provider)
    const status = modelRegistry.getProviderAuthStatus(provider)
    providers.push({
      id: provider,
      name: modelRegistry.getProviderDisplayName(provider),
      authType: "api_key",
      configured: status.configured || status.source !== undefined,
      source: status.source,
      label: status.label,
      storedType: cred?.type,
    })
  }

  return providers.sort((a, b) => a.name.localeCompare(b.name))
}

export async function setThinkingLevel(level: ThinkingLevel) {
  await rpc.sendCommand({ type: "set_thinking_level", level })
  await emitState()
}

export async function cycleThinkingLevel(): Promise<ThinkingLevel> {
  try {
    const raw = await rpc.sendCommand({ type: "cycle_thinking_level" }) as Record<string, unknown>
    return (raw["level"] as ThinkingLevel) ?? "low"
  } catch {
    return "low"
  }
}

export async function setApiKey(provider: string, key: string) {
  if (key.trim()) {
    authStorage.set(provider, { type: "api_key", key: key.trim() })
  } else {
    authStorage.remove(provider)
  }
  modelRegistry.refresh()
  await rpc.restart()
  await emitState()
}

export function getApiKeys(providers: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const p of providers) {
    const cred = authStorage.get(p)
    result[p] = cred?.type === "api_key" ? cred.key : ""
  }
  return result
}

export async function getState(): Promise<AgentState> {
  try {
    const raw = await rpc.sendCommand({ type: "get_state" })
    return normalizeState(raw)
  } catch {
    return {
      isStreaming: false,
      sessionId: "",
      thinkingLevel: "low",
      model: undefined,
      queuedSteering: null,
      queuedFollowUp: null,
      isRetrying: false,
      isCompacting: false,
    }
  }
}

export async function getTools(): Promise<ToolInfo[]> {
  try {
    const raw = await rpc.sendCommand({ type: "get_commands" }) as Record<string, unknown>
    const commands = raw["commands"] as unknown[]
    if (!Array.isArray(commands)) return []
    return commands.map((item) => {
      const command = item as Record<string, unknown>
      return {
        name: `/${command["name"] as string}`,
        description: (command["description"] as string | undefined) ?? "",
        source: (command["source"] as string | undefined) ?? "command",
        active: true,
      }
    })
  } catch {
    return []
  }
}

export function setActiveTools(_toolNames: string[]) {
}

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  await settingsManager.reload().catch(() => {})
  const state = await rpc.sendCommand({ type: "get_state" }).catch(() => null) as Record<string, unknown> | null
  return {
    defaultCwd: rpc.getCwd(),
    showImages: settingsManager.getShowImages(),
    imageAutoResize: settingsManager.getImageAutoResize(),
    blockImages: settingsManager.getBlockImages(),
    autoCompaction: ((state?.["autoCompactionEnabled"] as boolean | undefined) ?? settingsManager.getCompactionEnabled()),
    autoRetry: settingsManager.getRetryEnabled(),
    steeringMode: ((state?.["steeringMode"] as RuntimeSettings["steeringMode"] | undefined) ?? settingsManager.getSteeringMode()),
    followUpMode: ((state?.["followUpMode"] as RuntimeSettings["followUpMode"] | undefined) ?? settingsManager.getFollowUpMode()),
    transport: settingsManager.getTransport() as RuntimeSettings["transport"],
    hideThinkingBlock: settingsManager.getHideThinkingBlock(),
    quietStartup: settingsManager.getQuietStartup(),
    collapseChangelog: settingsManager.getCollapseChangelog(),
    enableInstallTelemetry: settingsManager.getEnableInstallTelemetry(),
  }
}

export async function setRuntimeSettings(partial: Partial<RuntimeSettings>) {
  if (partial.showImages !== undefined) settingsManager.setShowImages(partial.showImages)
  if (partial.imageAutoResize !== undefined) settingsManager.setImageAutoResize(partial.imageAutoResize)
  if (partial.blockImages !== undefined) settingsManager.setBlockImages(partial.blockImages)
  if (partial.hideThinkingBlock !== undefined) settingsManager.setHideThinkingBlock(partial.hideThinkingBlock)
  if (partial.quietStartup !== undefined) settingsManager.setQuietStartup(partial.quietStartup)
  if (partial.collapseChangelog !== undefined) settingsManager.setCollapseChangelog(partial.collapseChangelog)
  if (partial.enableInstallTelemetry !== undefined) settingsManager.setEnableInstallTelemetry(partial.enableInstallTelemetry)
  if (partial.transport !== undefined) settingsManager.setTransport(partial.transport)
  if (partial.steeringMode !== undefined) {
    settingsManager.setSteeringMode(partial.steeringMode)
    await rpc.sendCommand({ type: "set_steering_mode", mode: partial.steeringMode })
  }
  if (partial.followUpMode !== undefined) {
    settingsManager.setFollowUpMode(partial.followUpMode)
    await rpc.sendCommand({ type: "set_follow_up_mode", mode: partial.followUpMode })
  }
  if (partial.autoCompaction !== undefined) {
    settingsManager.setCompactionEnabled(partial.autoCompaction)
    await rpc.sendCommand({ type: "set_auto_compaction", enabled: partial.autoCompaction })
  }
  if (partial.autoRetry !== undefined) {
    settingsManager.setRetryEnabled(partial.autoRetry)
    await rpc.sendCommand({ type: "set_auto_retry", enabled: partial.autoRetry })
  }
  await settingsManager.flush()
  await emitState()
}

export function getSettings(): AppSettings {
  return {
    apiKeys: {},
    defaultCwd: rpc.getCwd(),
  }
}

export async function getPackages(): Promise<PiPackageInfo[]> {
  await reloadSettings()
  return packageManager().listConfiguredPackages()
}

export async function installPackage(source: string, local = false) {
  const normalized = source.trim()
  if (!normalized) throw new Error("Package source is required")
  await reloadSettings()
  await packageManager().installAndPersist(normalized, { local })
  await settingsManager.flush()
  await reloadSession()
}

export async function removePackage(source: string, local = false) {
  const normalized = source.trim()
  if (!normalized) throw new Error("Package source is required")
  await reloadSettings()
  await packageManager().removeAndPersist(normalized, { local })
  await settingsManager.flush()
  await reloadSession()
}

export async function updatePackage(source?: string) {
  const normalized = source?.trim()
  await reloadSettings()
  await packageManager().update(normalized || undefined)
  await reloadSession()
}

export async function searchPackageGallery(query: string, page = 1, type: PiPackageGalleryType = "", sort: PiPackageGallerySort = "downloads"): Promise<PiPackageGalleryResult> {
  const url = new URL("https://pi.dev/packages")
  const normalizedPage = Math.max(1, Math.floor(page || 1))
  const q = query.trim()
  if (normalizedPage > 1) url.searchParams.set("page", String(normalizedPage))
  if (q) url.searchParams.set("name", q)
  if (type) url.searchParams.set("type", type)
  if (sort && sort !== "downloads") url.searchParams.set("sort", sort)
  const html = await fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load package gallery: ${res.status}`)
    return res.text()
  })
  const items: PiPackageGalleryItem[] = []
  const cardRe = /<article class="[^"]*" data-package-card="true"([\s\S]*?)<\/article>/g
  for (const card of html.matchAll(cardRe)) {
    const cardHtml = card[0]
    const attrs = card[1]
    const name = decodeHtml(readAttr(attrs, "data-package-name"))
    const href = decodeHtml(readMatch(cardHtml, /<a href="(\/packages\/[^"]+)"[^>]*data-package-link="true"/))
    if (!name || !href) continue
    const description = decodeHtml(readMatch(cardHtml, /<p class="packages-desc">([\s\S]*?)<\/p>/))
    const meta = [...cardHtml.matchAll(/<div class="packages-meta">([\s\S]*?)<\/div>/g)][0]?.[1] ?? ""
    const metaValues = [...meta.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((m) => decodeHtml(m[1]))
    const types = decodeHtml(readAttr(attrs, "data-package-types")).split(/\s+/).filter(Boolean)
    items.push({
      name,
      description,
      href: `https://pi.dev${href}`,
      source: `npm:${name}`,
      author: metaValues[0],
      downloads: Number(readAttr(attrs, "data-package-downloads")) || undefined,
      downloadsLabel: metaValues[1],
      published: metaValues[2],
      types,
    })
  }
  const countText = decodeHtml(html.match(/<span class="packages-count">([\s\S]*?)<\/span>/)?.[1] ?? "")
  const totalMatch = countText.match(/\/\s*([\d,]+)/)
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null
  const totalPages = total ? Math.ceil(total / 50) : null
  const hasNext = new RegExp(`href="/packages\\?[^"]*page=${normalizedPage + 1}`).test(html)
  return { items, page: normalizedPage, total, totalPages, hasNext: hasNext || (totalPages ? normalizedPage < totalPages : false) }
}

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim()
}

function readAttr(value: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return readMatch(value, new RegExp(`${escaped}="([^"]*)"`, "i"))
}

function readMatch(value: string, re: RegExp) {
  return value.match(re)?.[1] ?? ""
}

async function emitState() {
  const state = await rpc.sendCommand({ type: "get_state" }).catch(() => null)
  if (state && win) win.webContents.send("agent:stateChange", normalizeState(state))
}
