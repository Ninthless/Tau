import { app, BrowserWindow, shell } from "electron"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { registerIpcHandlers } from "./ipc"
import { initAgent, setWindow } from "./agent"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = !!process.env["ELECTRON_RENDERER_URL"]

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: "#1a1a1a",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  setWindow(win)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  if (isDev) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"] ?? "http://localhost:5173")
    win.webContents.openDevTools({ mode: "detach" })
  } else {
    win.loadFile(join(__dirname, "../../out/renderer/index.html"))
  }

  return win
}

app.whenReady().then(async () => {
  registerIpcHandlers()
  createWindow()

  try {
    await initAgent(process.cwd())
  } catch (err) {
    console.error("Agent init failed:", err)
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
