import { spawn, ChildProcess } from "child_process"
import { mkdirSync, statSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { StringDecoder } from "string_decoder"
import { dialog, BrowserWindow, type MessageBoxOptions } from "electron"
import { tmpdir } from "os"

const __dirname = dirname(fileURLToPath(import.meta.url))
let piCliPath: string
try {
  piCliPath = join(dirname(fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"))), "cli.js")
} catch {
  piCliPath = join(process.cwd(), "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js")
}

interface PendingRequest {
  resolve: (data: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface RpcResponse {
  id?: string
  type: "response"
  command: string
  success: boolean
  data?: unknown
  error?: string
}

interface ExtensionUiRequest {
  type: "extension_ui_request"
  id: string
  method: string
  title?: string
  message?: string
  options?: string[]
  placeholder?: string
  prefill?: string
  timeout?: number
}

type ExtensionUiDialogResult =
  | { cancelled: true }
  | { value: string }

const STATE_CHANGE_EVENTS = new Set([
  "agent_start",
  "agent_end",
  "queue_update",
  "compaction_start",
  "compaction_end",
  "auto_retry_start",
  "auto_retry_end",
  "session_info_changed",
  "thinking_level_changed",
])

export class RpcClient {
  private proc: ChildProcess | null = null
  private win: BrowserWindow | null = null
  private pending = new Map<string, PendingRequest>()
  private reqId = 0
  private readonly sessionId = Math.random().toString(36).slice(2, 8)
  private buf = ""
  private decoder = new StringDecoder("utf8")
  private cwd = process.cwd()
  private queuedSteering: string | null = null
  private queuedFollowUp: string | null = null

  setWindow(w: BrowserWindow) {
    this.win = w
  }

  async start(cwd: string) {
    this.cwd = cwd
    await this.spawnProcess(cwd)
  }

  private findNodePath(): string {
    const envNode = process.env["PI_NODE_PATH"] ?? process.env["NODE_PATH_OVERRIDE"]
    if (envNode) return envNode
    const pathDirs = (process.env["PATH"] ?? "").split(process.platform === "win32" ? ";" : ":")
    for (const dir of pathDirs) {
      const candidates = process.platform === "win32"
        ? [`${dir}\\node.exe`, `${dir}\\node`]
        : [`${dir}/node`]
      for (const c of candidates) {
        try {
          statSync(c)
          return c
        } catch {}
      }
    }
    return "node"
  }

  private async spawnProcess(cwd: string) {
    this.stop()
    this.cwd = cwd
    this.buf = ""
    this.decoder = new StringDecoder("utf8")
    this.queuedSteering = null
    this.queuedFollowUp = null

    const child = spawn(this.findNodePath(), [piCliPath, "--mode", "rpc", "--continue"], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    })
    this.proc = child

    child.stdout!.on("data", (chunk: Buffer) => {
      this.buf += this.decoder.write(chunk)
      let nl: number
      while ((nl = this.buf.indexOf("\n")) !== -1) {
        let line = this.buf.slice(0, nl)
        this.buf = this.buf.slice(nl + 1)
        if (line.endsWith("\r")) line = line.slice(0, -1)
        if (line) this.handleLine(line)
      }
    })

    child.stdout!.on("end", () => {
      this.buf += this.decoder.end()
      if (this.buf) {
        const line = this.buf.endsWith("\r") ? this.buf.slice(0, -1) : this.buf
        this.buf = ""
        if (line) this.handleLine(line)
      }
    })

    child.stderr!.on("data", (chunk: Buffer) => {
      console.error("[pi rpc stderr]", chunk.toString("utf8").trim())
    })

    child.on("exit", (code) => {
      console.log("[pi rpc] process exited with code", code)
      if (this.proc === child) {
        this.proc = null
        this.rejectPending(new Error(`RPC process exited with code ${code ?? "unknown"}`))
      }
    })

    child.on("error", (err) => {
      console.error("[pi rpc] process error:", err)
      if (this.proc === child) {
        this.proc = null
        this.rejectPending(err)
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 100))
    if (child.exitCode !== null) {
      throw new Error(`RPC process exited immediately with code ${child.exitCode}`)
    }
  }

  stop() {
    if (this.proc) {
      this.proc.kill()
      this.proc = null
    }
    this.rejectPending(new Error("RPC client stopped"))
  }

  private rejectPending(err: Error) {
    for (const [, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(err)
    }
    this.pending.clear()
  }

  private handleLine(line: string) {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(line)
    } catch {
      console.warn("[pi rpc] non-JSON line:", line)
      return
    }

    if (msg["type"] === "response") {
      const res = msg as unknown as RpcResponse
      if (res.id) {
        const pending = this.pending.get(res.id)
        if (pending) {
          clearTimeout(pending.timer)
          this.pending.delete(res.id)
          if (res.success) pending.resolve(res.data)
          else pending.reject(new Error(res.error ?? "RPC command failed"))
          return
        }
      }
      return
    }

    if (msg["type"] === "extension_ui_request") {
      this.handleExtensionUiRequest(msg as unknown as ExtensionUiRequest)
      return
    }

    if (msg["type"] === "queue_update") {
      const steering = msg["steering"] as unknown[]
      const followUp = msg["followUp"] as unknown[]
      this.queuedSteering = Array.isArray(steering) && steering.length > 0 ? "queued" : null
      this.queuedFollowUp = Array.isArray(followUp) && followUp.length > 0 ? "queued" : null
    }

    this.win?.webContents.send("agent:event", msg)

    if (STATE_CHANGE_EVENTS.has(msg["type"] as string)) {
      this.sendCommand({ type: "get_state" })
        .then((state) => this.win?.webContents.send("agent:stateChange", this.normalizeState(state)))
        .catch(() => {})
    }
  }

  private async handleExtensionUiRequest(req: ExtensionUiRequest) {
    const { method, id } = req
    if (method === "notify" || method === "setStatus" || method === "setWidget" || method === "setTitle" || method === "set_editor_text") {
      this.win?.webContents.send("agent:event", req)
      return
    }
    if (method === "confirm") {
      const options: MessageBoxOptions = {
        type: "question",
        title: req.title ?? "Pi",
        message: req.message ?? req.title ?? "Confirm",
        buttons: ["OK", "Cancel"],
        defaultId: 0,
        cancelId: 1,
      }
      const result = this.win
        ? await dialog.showMessageBox(this.win, options)
        : await dialog.showMessageBox(options)
      this.sendRaw({ type: "extension_ui_response", id, confirmed: result.response === 0 })
    } else if (method === "select") {
      const options = req.options ?? []
      if (options.length === 0) {
        this.sendRaw({ type: "extension_ui_response", id, cancelled: true })
        return
      }
      const messageBoxOptions: MessageBoxOptions = {
        type: "question",
        title: req.title ?? "Pi",
        message: req.message ?? req.title ?? "Select",
        buttons: [...options],
        defaultId: 0,
        cancelId: options.length - 1,
      }
      const result = this.win
        ? await dialog.showMessageBox(this.win, messageBoxOptions)
        : await dialog.showMessageBox(messageBoxOptions)
      const value = options[result.response]
      if (value) this.sendRaw({ type: "extension_ui_response", id, value })
      else this.sendRaw({ type: "extension_ui_response", id, cancelled: true })
    } else if (method === "input" || method === "editor") {
      const result = await this.showTextDialog(req, method === "editor")
      if ("cancelled" in result) this.sendRaw({ type: "extension_ui_response", id, cancelled: true })
      else this.sendRaw({ type: "extension_ui_response", id, value: result.value })
    } else {
      this.win?.webContents.send("agent:event", req)
      this.sendRaw({ type: "extension_ui_response", id, cancelled: true })
    }
  }

  private async showTextDialog(req: ExtensionUiRequest, multiline: boolean): Promise<ExtensionUiDialogResult> {
    const html = this.buildTextDialogHtml(req, multiline)
    const dir = join(tmpdir(), "tau-extension-ui")
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `dialog-${req.id}.html`)
    writeFileSync(file, html, "utf8")
    const preload = join(dir, "preload.js")
    writeFileSync(preload, this.buildTextDialogPreload(), "utf8")

    const child = new BrowserWindow({
      parent: this.win ?? undefined,
      modal: Boolean(this.win),
      width: 520,
      height: multiline ? 420 : 240,
      resizable: multiline,
      minimizable: false,
      maximizable: false,
      title: req.title ?? "Pi",
      backgroundColor: "#18181b",
      webPreferences: {
        preload,
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    return new Promise((resolve) => {
      let settled = false
      const finish = (result: ExtensionUiDialogResult) => {
        if (settled) return
        settled = true
        resolve(result)
        if (!child.isDestroyed()) child.close()
      }
      child.webContents.on("ipc-message", (_event, channel, value) => {
        if (channel === "tau-extension-submit") finish({ value: String(value ?? "") })
        if (channel === "tau-extension-cancel") finish({ cancelled: true })
      })
      child.on("closed", () => finish({ cancelled: true }))
      child.loadFile(file)
    })
  }

  private buildTextDialogPreload() {
    return `const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("tauExtensionDialog", {
  submit: (value) => ipcRenderer.send("tau-extension-submit", value),
  cancel: () => ipcRenderer.send("tau-extension-cancel")
});
`
  }

  private buildTextDialogHtml(req: ExtensionUiRequest, multiline: boolean) {
    const title = escapeHtml(req.title ?? "Pi")
    const placeholder = escapeHtml(req.placeholder ?? "")
    const prefill = escapeHtml(req.prefill ?? "")
    const field = multiline
      ? `<textarea id="value" placeholder="${placeholder}">${prefill}</textarea>`
      : `<input id="value" placeholder="${placeholder}" value="${prefill}" />`
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
html,body{margin:0;height:100%;background:#18181b;color:#e5e7eb;font-family:Inter,Segoe UI,Arial,sans-serif}
body{box-sizing:border-box;padding:18px;display:flex;flex-direction:column;gap:14px}
h1{margin:0;font-size:15px;font-weight:600}
p{margin:0;color:#9ca3af;font-size:12px}
input,textarea{box-sizing:border-box;width:100%;border:1px solid #333;background:#111827;color:#e5e7eb;border-radius:8px;padding:10px;font:13px ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}
textarea{flex:1;resize:none;min-height:240px}
.buttons{display:flex;justify-content:flex-end;gap:8px}
button{border:0;border-radius:7px;padding:7px 12px;font-size:12px;color:#e5e7eb;background:#27272a}
button.primary{background:#2563eb}
</style>
</head>
<body>
<h1>${title}</h1>
${req.message ? `<p>${escapeHtml(req.message)}</p>` : ""}
${field}
<div class="buttons">
<button id="cancel">Cancel</button>
<button id="ok" class="primary">OK</button>
</div>
<script>
const value = document.getElementById("value");
document.getElementById("ok").onclick = () => window.tauExtensionDialog.submit(value.value);
document.getElementById("cancel").onclick = () => window.tauExtensionDialog.cancel();
value.focus();
value.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.tauExtensionDialog.cancel();
  if (!${JSON.stringify(multiline)} && e.key === "Enter") window.tauExtensionDialog.submit(value.value);
});
</script>
</body>
</html>`
  }

  private normalizeState(raw: unknown) {
    const s = raw as Record<string, unknown>
    const model = s["model"] as Record<string, unknown> | undefined
    return {
      isStreaming: s["isStreaming"] ?? false,
      sessionId: s["sessionId"] ?? "",
      thinkingLevel: s["thinkingLevel"] ?? "low",
      model: model ? { id: model["id"], provider: model["provider"], name: model["name"] ?? model["id"] } : undefined,
      queuedSteering: this.queuedSteering ?? ((s["pendingMessageCount"] as number) > 0 ? "queued" : null),
      queuedFollowUp: this.queuedFollowUp,
      isRetrying: s["isRetrying"] ?? false,
      isCompacting: s["isCompacting"] ?? false,
      sessionName: s["sessionName"],
      steeringMode: s["steeringMode"],
      followUpMode: s["followUpMode"],
      autoCompactionEnabled: s["autoCompactionEnabled"],
    }
  }

  private sendRaw(msg: Record<string, unknown>) {
    if (!this.proc?.stdin?.writable) {
      console.warn("[pi rpc] stdin not writable, dropping:", msg)
      return false
    }
    this.proc.stdin.write(JSON.stringify(msg) + "\n")
    return true
  }

  async sendCommand(msg: Record<string, unknown>, timeoutMs = 15000): Promise<unknown> {
    if (!this.proc?.stdin?.writable) {
      throw new Error("RPC client is not running")
    }
    const id = `tau-${this.sessionId}-${++this.reqId}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`RPC timeout: ${msg["type"]}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      if (!this.sendRaw({ ...msg, id })) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(new Error("RPC client is not running"))
      }
    })
  }

  async restart(cwd?: string) {
    await this.spawnProcess(cwd ?? this.cwd)
  }

  get isRunning() {
    return this.proc !== null && !this.proc.killed
  }

  getCwd() {
    return this.cwd
  }

  getQueueSummary() {
    return {
      queuedSteering: this.queuedSteering,
      queuedFollowUp: this.queuedFollowUp,
    }
  }
}

export const rpc = new RpcClient()

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
