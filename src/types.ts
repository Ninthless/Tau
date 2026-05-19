export type MessageRole = "user" | "assistant"

export interface TextBlock {
  type: "text"
  text: string
}

export interface ImageBlock {
  type: "image"
  data: string
  mimeType: string
}

export interface ThinkingBlock {
  type: "thinking"
  text: string
  collapsed: boolean
}

export interface ToolCallBlock {
  type: "tool_call"
  toolCallId: string
  toolName: string
  label: string
  args: Record<string, unknown>
  status: "running" | "done" | "error"
  partialResult?: string
  result?: string
  collapsed: boolean
}

export type MessageBlock = TextBlock | ImageBlock | ThinkingBlock | ToolCallBlock

export interface ChatMessage {
  id: string
  role: MessageRole
  blocks: MessageBlock[]
}

export interface SessionInfo {
  path: string
  id: string
  cwd: string
  created: string
  modified: string
  messageCount: number
  firstMessage: string
}

export interface SessionStats {
  sessionFile?: string
  sessionId: string
  sessionName?: string
  userMessages: number
  assistantMessages: number
  toolCalls: number
  toolResults: number
  totalMessages: number
  tokens: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    total: number
  }
  cost: number
}

export interface SessionTreeItem {
  id: string
  parentId: string | null
  type: string
  role?: string
  title: string
  timestamp: string
  depth: number
  active: boolean
  label?: string
}

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"

export interface AppSettings {
  apiKeys: Record<string, string>
  defaultCwd: string
  defaultProvider?: string
  defaultModel?: string
  defaultThinkingLevel?: ThinkingLevel
}

export interface AgentState {
  isStreaming: boolean
  sessionId: string
  thinkingLevel: ThinkingLevel
  model: { id: string; provider: string; name: string } | undefined
  queuedSteering: string | null
  queuedFollowUp: string | null
  isRetrying: boolean
  isCompacting: boolean
}

export interface AvailableModel {
  id: string
  name: string
  provider: string
  providerName: string
  reasoning: boolean
  contextWindow: number
  hasAuth: boolean
  authSource?: string
  authLabel?: string
  current?: boolean
  default?: boolean
}

export interface AuthProviderInfo {
  id: string
  name: string
  authType: "api_key" | "oauth"
  configured: boolean
  source?: string
  label?: string
  storedType?: "api_key" | "oauth"
}

export interface ToolInfo {
  name: string
  description: string
  source: string
  active: boolean
}

export interface RuntimeSettings {
  defaultCwd: string
  showImages: boolean
  imageAutoResize: boolean
  blockImages: boolean
  autoCompaction: boolean
  autoRetry: boolean
  steeringMode: "all" | "one-at-a-time"
  followUpMode: "all" | "one-at-a-time"
  transport: "sse" | "websocket" | "auto"
  hideThinkingBlock: boolean
  quietStartup: boolean
  collapseChangelog: boolean
  enableInstallTelemetry: boolean
}

export interface PiPackageInfo {
  source: string
  scope: "user" | "project"
  filtered: boolean
  installedPath?: string
}

export interface PiPackageGalleryItem {
  name: string
  description: string
  href: string
  source: string
  author?: string
  downloads?: number
  downloadsLabel?: string
  published?: string
  types: string[]
}

export type PiPackageGalleryType = "" | "extension" | "skill" | "theme" | "prompt"
export type PiPackageGallerySort = "downloads" | "recent" | "name"

export interface PiPackageGalleryResult {
  items: PiPackageGalleryItem[]
  page: number
  total: number | null
  totalPages: number | null
  hasNext: boolean
}

export interface PiPackageProgress {
  type: "start" | "progress" | "complete" | "error"
  action: "install" | "remove" | "update" | "clone" | "pull"
  source: string
  message?: string
}

export interface ImageAttachment {
  name: string
  data: string
  mimeType: string
}

declare global {
  interface Window {
    piAgent: {
      prompt: (text: string, images?: ImageAttachment[]) => Promise<void>
      steer: (text: string) => Promise<void>
      followUp: (text: string) => Promise<void>
      abort: () => Promise<void>
      newSession: (cwd: string) => Promise<void>
      switchSession: (path: string) => Promise<void>
      fork: (entryId: string) => Promise<void>
      compact: (instructions?: string) => Promise<void>
      navigateTree: (targetId: string) => Promise<void>
      setSessionName: (name: string) => Promise<void>
      getSessionStats: () => Promise<SessionStats | null>
      getSessionTree: () => Promise<SessionTreeItem[]>
      getMessages: () => Promise<ChatMessage[]>
      exportSessionHtml: () => Promise<string>
      reloadSession: () => Promise<void>
      listSessions: (cwd: string) => Promise<SessionInfo[]>
      setModel: (provider: string, modelId: string) => Promise<{ ok: boolean }>
      getModels: () => Promise<AvailableModel[]>
      getAuthProviders: () => Promise<AuthProviderInfo[]>
      setThinkingLevel: (level: ThinkingLevel) => Promise<void>
      cycleThinkingLevel: () => Promise<ThinkingLevel>
      getState: () => Promise<AgentState>
      getSettings: () => Promise<AppSettings>
      setSettings: (settings: Partial<AppSettings>) => Promise<void>
      setApiKey: (provider: string, key: string) => Promise<void>
      getTools: () => Promise<ToolInfo[]>
      setActiveTools: (toolNames: string[]) => Promise<void>
      getRuntimeSettings: () => Promise<RuntimeSettings>
      setRuntimeSettings: (settings: Partial<RuntimeSettings>) => Promise<void>
      getPackages: () => Promise<PiPackageInfo[]>
      installPackage: (source: string, local?: boolean) => Promise<void>
      removePackage: (source: string, local?: boolean) => Promise<void>
      updatePackage: (source?: string) => Promise<void>
      searchPackageGallery: (query: string, page?: number, type?: PiPackageGalleryType, sort?: PiPackageGallerySort) => Promise<PiPackageGalleryResult>
      onEvent: (cb: (event: unknown) => void) => () => void
      onStateChange: (cb: (state: AgentState) => void) => () => void
      onPackageProgress: (cb: (event: PiPackageProgress) => void) => () => void
    }
  }
}
