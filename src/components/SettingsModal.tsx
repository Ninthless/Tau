import { useEffect, useMemo, useState } from "react"
import type { AppSettings, AuthProviderInfo, AvailableModel, PiPackageGalleryItem, PiPackageGallerySort, PiPackageGalleryType, PiPackageInfo, PiPackageProgress, RuntimeSettings } from "../types"

interface Props {
  onClose: (savedCwd?: string) => void
}

export function SettingsModal({ onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings>({ apiKeys: {}, defaultCwd: "." })
  const [models, setModels] = useState<AvailableModel[]>([])
  const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([])
  const [modelSearch, setModelSearch] = useState("")
  const [selectedModel, setSelectedModel] = useState<AvailableModel | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings | null>(null)
  const [packages, setPackages] = useState<PiPackageInfo[]>([])
  const [packageSource, setPackageSource] = useState("")
  const [packageLocal, setPackageLocal] = useState(false)
  const [packageBusy, setPackageBusy] = useState<string | null>(null)
  const [packageError, setPackageError] = useState<string | null>(null)
  const [packageProgress, setPackageProgress] = useState<PiPackageProgress | null>(null)
  const [galleryQuery, setGalleryQuery] = useState("")
  const [gallery, setGallery] = useState<PiPackageGalleryItem[]>([])
  const [galleryPage, setGalleryPage] = useState(1)
  const [galleryTotal, setGalleryTotal] = useState<number | null>(null)
  const [galleryHasNext, setGalleryHasNext] = useState(false)
  const [galleryType, setGalleryType] = useState<PiPackageGalleryType>("")
  const [gallerySort, setGallerySort] = useState<PiPackageGallerySort>("downloads")
  const [galleryLoading, setGalleryLoading] = useState(false)

  const refreshAuthAndModels = async () => {
    const [updatedProviders, updatedModels, state] = await Promise.all([
      window.piAgent.getAuthProviders(),
      window.piAgent.getModels(),
      window.piAgent.getState(),
    ])
    setAuthProviders(updatedProviders)
    setModels(updatedModels)
    const current = updatedModels.find(
      (model) => model.provider === state.model?.provider && model.id === state.model.id
    )
    setSelectedModel((prev) => {
      if (prev) {
        return updatedModels.find((model) => model.provider === prev.provider && model.id === prev.id) ?? current ?? null
      }
      return current ?? updatedModels.find((model) => model.default) ?? null
    })
  }

  const refreshPackages = async () => {
    setPackages(await window.piAgent.getPackages())
  }

  useEffect(() => {
    Promise.all([
      window.piAgent.getSettings(),
      window.piAgent.getAuthProviders(),
      window.piAgent.getModels(),
      window.piAgent.getState(),
      window.piAgent.getRuntimeSettings(),
      window.piAgent.getPackages(),
      window.piAgent.searchPackageGallery("", 1),
    ]).then(([s, providers, m, state, runtime, pkg, galleryResult]) => {
      setSettings(s)
      setRuntimeSettings(runtime)
      setAuthProviders(providers)
      setModels(m)
      setPackages(pkg)
      setGallery(galleryResult.items)
      setGalleryPage(galleryResult.page)
      setGalleryTotal(galleryResult.total)
      setGalleryHasNext(galleryResult.hasNext)
      const current = m.find(
        (x) => x.id === state.model?.id && x.provider === state.model.provider
      )
      setSelectedModel(current ?? m.find((x) => x.default) ?? null)
    }).catch(() => {})
    const unsub = window.piAgent.onPackageProgress((event) => setPackageProgress(event))
    return unsub
  }, [])

  const filteredModels = useMemo(() => {
    const q = modelSearch.toLowerCase()
    return models
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q) || m.providerName.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 50)
  }, [models, modelSearch])

  const save = async () => {
    setSaving(true)
    setModelError(null)
    try {
      await window.piAgent.setSettings({ defaultCwd: settings.defaultCwd })
      if (runtimeSettings) {
        await window.piAgent.setRuntimeSettings(runtimeSettings)
      }
      if (selectedModel) {
        const result = await window.piAgent.setModel(selectedModel.provider, selectedModel.id)
        if (!result.ok) {
          setModelError(`No API key configured for ${selectedModel.provider}. Add the key above first.`)
          return
        }
      }
      onClose(settings.defaultCwd)
    } finally {
      setSaving(false)
    }
  }

  const saveKeyImmediately = async (provider: string, key: string) => {
    setSavingKey(provider)
    try {
      await window.piAgent.setApiKey(provider, key)
      await refreshAuthAndModels()
    } finally {
      setSavingKey(null)
    }
  }

  const runPackageAction = async (label: string, action: () => Promise<void>) => {
    setPackageBusy(label)
    setPackageError(null)
    try {
      await action()
      await Promise.all([refreshPackages(), refreshAuthAndModels()])
    } catch (err) {
      setPackageError(err instanceof Error ? err.message : String(err))
    } finally {
      setPackageBusy(null)
    }
  }

  const installPackage = async (source = packageSource) => {
    const normalized = source.trim()
    if (!normalized) return
    await runPackageAction(`install:${normalized}`, async () => {
      await window.piAgent.installPackage(normalized, packageLocal)
      setPackageSource("")
    })
  }

  const removePackage = async (pkg: PiPackageInfo) => {
    await runPackageAction(`remove:${pkg.source}:${pkg.scope}`, async () => {
      await window.piAgent.removePackage(pkg.source, pkg.scope === "project")
    })
  }

  const updatePackage = async (source?: string) => {
    await runPackageAction(`update:${source ?? "all"}`, async () => {
      await window.piAgent.updatePackage(source)
    })
  }

  const loadGallery = async (page = 1, append = false) => {
    setGalleryLoading(true)
    setPackageError(null)
    try {
      const result = await window.piAgent.searchPackageGallery(galleryQuery, page, galleryType, gallerySort)
      setGallery((prev) => append ? [...prev, ...result.items] : result.items)
      setGalleryPage(result.page)
      setGalleryTotal(result.total)
      setGalleryHasNext(result.hasNext)
    } catch (err) {
      setPackageError(err instanceof Error ? err.message : String(err))
    } finally {
      setGalleryLoading(false)
    }
  }

  const searchGallery = async () => loadGallery(1, false)

  const loadMoreGallery = async () => loadGallery(galleryPage + 1, true)

  const getAuthLabel = (provider: AuthProviderInfo) => {
    if (provider.storedType === "oauth") return "subscription"
    if (provider.storedType === "api_key") return "stored key"
    if (provider.source === "environment") return provider.label ? `env: ${provider.label}` : "environment"
    if (provider.source === "models_json_key") return "models.json key"
    if (provider.source === "models_json_command") return "models.json command"
    if (provider.source === "fallback") return "custom config"
    return "not configured"
  }

  const setRuntime = <K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) => {
    setRuntimeSettings((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const checkbox = (key: keyof Pick<RuntimeSettings,
    "showImages" |
    "imageAutoResize" |
    "blockImages" |
    "autoCompaction" |
    "autoRetry" |
    "hideThinkingBlock" |
    "quietStartup" |
    "collapseChangelog" |
    "enableInstallTelemetry"
  >, label: string) => (
    <label className="flex items-center justify-between gap-3 rounded bg-surface/60 px-3 py-2 text-xs text-gray-400">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-accent"
        checked={Boolean(runtimeSettings?.[key])}
        onChange={(e) => setRuntime(key, e.target.checked)}
      />
    </label>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[520px] max-h-[85vh] flex flex-col rounded-xl border border-border bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold text-gray-200">Settings</h2>
          <button className="text-gray-500 hover:text-gray-300" onClick={() => onClose()}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">API Keys</h3>
            <p className="mb-3 text-xs text-gray-600">Saved to ~/.pi/agent/auth.json. Environment variables and models.json entries are detected but not overwritten.</p>
            <div className="space-y-2">
              {authProviders.filter((p) => p.authType === "api_key").map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <label className="w-32 shrink-0 truncate text-xs text-gray-400" title={p.id}>{p.name}</label>
                  <input
                    type="password"
                    className="flex-1 rounded bg-surface px-3 py-1.5 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-accent/50"
                    placeholder={getAuthLabel(p)}
                    defaultValue={settings.apiKeys[p.id] ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value.trim()
                      if (val !== (settings.apiKeys[p.id] ?? "")) saveKeyImmediately(p.id, val)
                    }}
                  />
                  <span className={`w-24 shrink-0 truncate text-[10px] ${p.configured ? "text-green-500" : "text-gray-600"}`}>
                    {savingKey === p.id ? "saved" : getAuthLabel(p)}
                  </span>
                </div>
              ))}
            </div>
            {authProviders.some((p) => p.authType === "oauth") && (
              <div className="mt-3 rounded border border-border bg-surface/60 px-3 py-2">
                <div className="mb-1 text-xs font-medium text-gray-400">Subscriptions</div>
                <div className="space-y-1">
                  {authProviders.filter((p) => p.authType === "oauth").map((p) => (
                    <div key={p.id} className="flex justify-between gap-3 text-xs">
                      <span className="truncate text-gray-400">{p.name}</span>
                      <span className={p.configured ? "text-green-500" : "text-gray-600"}>{getAuthLabel(p)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Model</h3>
            <input
              className="mb-2 w-full rounded bg-surface px-3 py-1.5 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-accent/50"
              placeholder="Search models…"
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto rounded border border-border">
              {filteredModels.map((m) => (
                <button
                  key={`${m.provider}/${m.id}`}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-white/5 ${
                    selectedModel?.id === m.id && selectedModel?.provider === m.provider
                      ? "bg-accent/20 text-accent"
                      : "text-gray-400"
                  }`}
                  onClick={() => { if (m.hasAuth) { setSelectedModel(m); setModelError(null) } }}
                  disabled={!m.hasAuth}
                >
                  <span className={`truncate ${m.hasAuth ? "" : "opacity-50"}`}>{m.id}</span>
                  <span className="ml-2 shrink-0 text-gray-600">
                    {m.providerName}{m.reasoning ? " · reasoning" : ""}{m.current ? " · current" : m.default ? " · default" : ""}
                  </span>
                </button>
              ))}
              {filteredModels.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-600">No models found</p>
              )}
            </div>
            {selectedModel && !modelError && (
              <p className="mt-1 text-xs text-gray-600">
                {selectedModel.name} · {selectedModel.providerName}
                {selectedModel.contextWindow > 0 && ` · ${(selectedModel.contextWindow / 1000).toFixed(0)}k ctx`}
              </p>
            )}
            {modelError && (
              <p className="mt-1 text-xs text-red-400">{modelError}</p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Default Working Directory</h3>
            <input
              className="w-full rounded bg-surface px-3 py-1.5 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-accent/50"
              placeholder="/path/to/project"
              value={settings.defaultCwd}
              onChange={(e) => setSettings((s) => ({ ...s, defaultCwd: e.target.value }))}
            />
          </section>

          {runtimeSettings && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Runtime</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {checkbox("showImages", "Show images")}
                {checkbox("imageAutoResize", "Auto-resize images")}
                {checkbox("blockImages", "Block image sending")}
                {checkbox("autoCompaction", "Auto-compaction")}
                {checkbox("autoRetry", "Auto-retry")}
                {checkbox("hideThinkingBlock", "Hide thinking blocks")}
                {checkbox("quietStartup", "Quiet startup")}
                {checkbox("collapseChangelog", "Collapse changelog")}
                {checkbox("enableInstallTelemetry", "Install telemetry")}
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="text-xs text-gray-500">
                  Steering
                  <select
                    className="mt-1 w-full rounded bg-surface px-2 py-1.5 text-gray-300 outline-none"
                    value={runtimeSettings.steeringMode}
                    onChange={(e) => setRuntime("steeringMode", e.target.value as RuntimeSettings["steeringMode"])}
                  >
                    <option value="one-at-a-time">one-at-a-time</option>
                    <option value="all">all</option>
                  </select>
                </label>
                <label className="text-xs text-gray-500">
                  Follow-up
                  <select
                    className="mt-1 w-full rounded bg-surface px-2 py-1.5 text-gray-300 outline-none"
                    value={runtimeSettings.followUpMode}
                    onChange={(e) => setRuntime("followUpMode", e.target.value as RuntimeSettings["followUpMode"])}
                  >
                    <option value="one-at-a-time">one-at-a-time</option>
                    <option value="all">all</option>
                  </select>
                </label>
                <label className="text-xs text-gray-500">
                  Transport
                  <select
                    className="mt-1 w-full rounded bg-surface px-2 py-1.5 text-gray-300 outline-none"
                    value={runtimeSettings.transport}
                    onChange={(e) => setRuntime("transport", e.target.value as RuntimeSettings["transport"])}
                  >
                    <option value="auto">auto</option>
                    <option value="sse">sse</option>
                    <option value="websocket">websocket</option>
                  </select>
                </label>
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Packages & Extensions</h3>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded bg-surface px-3 py-1.5 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-accent/50"
                placeholder="npm:package, git:github.com/user/repo, or local path"
                value={packageSource}
                onChange={(e) => setPackageSource(e.target.value)}
              />
              <label className="flex items-center gap-1 rounded bg-surface px-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-accent"
                  checked={packageLocal}
                  onChange={(e) => setPackageLocal(e.target.checked)}
                />
                local
              </label>
              <button
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/80 disabled:opacity-50"
                disabled={!!packageBusy || !packageSource.trim()}
                onClick={() => installPackage()}
              >
                Install
              </button>
            </div>
            {packageProgress && (
              <div className="mt-2 truncate text-xs text-gray-600">
                {packageProgress.action} {packageProgress.source}: {packageProgress.message ?? packageProgress.type}
              </div>
            )}
            {packageError && (
              <div className="mt-2 text-xs text-red-400">{packageError}</div>
            )}
            <div className="mt-3 space-y-2">
              {packages.map((pkg) => (
                <div key={`${pkg.scope}:${pkg.source}`} className="flex items-center gap-2 rounded border border-border bg-surface/50 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-gray-300">{pkg.source}</div>
                    <div className="truncate text-[10px] text-gray-600">
                      {pkg.scope}{pkg.filtered ? " · filtered" : ""}{pkg.installedPath ? ` · ${pkg.installedPath}` : " · not installed"}
                    </div>
                  </div>
                  <button
                    className="rounded px-2 py-1 text-gray-500 hover:bg-white/10 hover:text-gray-300 disabled:opacity-50"
                    disabled={!!packageBusy}
                    onClick={() => updatePackage(pkg.source)}
                  >
                    Update
                  </button>
                  <button
                    className="rounded px-2 py-1 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    disabled={!!packageBusy}
                    onClick={() => removePackage(pkg)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {packages.length === 0 && (
                <div className="rounded border border-border bg-surface/50 px-3 py-2 text-xs text-gray-600">
                  No packages configured
                </div>
              )}
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_120px_120px]">
              <input
                className="min-w-0 flex-1 rounded bg-surface px-3 py-1.5 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-accent/50"
                placeholder="Search pi.dev packages"
                value={galleryQuery}
                onChange={(e) => setGalleryQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") searchGallery() }}
              />
              <select
                className="rounded bg-surface px-2 py-1.5 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-accent/50"
                value={galleryType}
                onChange={(e) => setGalleryType(e.target.value as PiPackageGalleryType)}
              >
                <option value="">All types</option>
                <option value="extension">extension</option>
                <option value="skill">skill</option>
                <option value="theme">theme</option>
                <option value="prompt">prompt</option>
              </select>
              <select
                className="rounded bg-surface px-2 py-1.5 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-accent/50"
                value={gallerySort}
                onChange={(e) => setGallerySort(e.target.value as PiPackageGallerySort)}
              >
                <option value="downloads">Downloads</option>
                <option value="recent">Recent</option>
                <option value="name">A-Z</option>
              </select>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                className="rounded bg-surface px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                disabled={galleryLoading}
                onClick={searchGallery}
              >
                {galleryLoading ? "Loading" : "Search"}
              </button>
              <button
                className="rounded bg-surface px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50"
                disabled={!!packageBusy}
                onClick={() => updatePackage()}
              >
                Update all
              </button>
              <span className="min-w-0 flex-1 truncate text-right text-[10px] text-gray-600">
                {galleryTotal === null ? `${gallery.length} shown` : `${gallery.length} / ${galleryTotal} shown`}
              </span>
            </div>
            <div className="mt-2 max-h-44 overflow-y-auto rounded border border-border">
              {gallery.map((item) => (
                <button
                  key={`${item.href}:${item.source}`}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs hover:bg-white/5"
                  onClick={() => setPackageSource(item.source)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-gray-300">{item.name}</div>
                    <div className="truncate text-[10px] text-gray-600">{item.description}</div>
                    <div className="truncate text-[10px] text-gray-700">
                      {[item.author, item.downloadsLabel, item.types.join(", ")].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-gray-600">{item.published ?? ""}</span>
                </button>
              ))}
              {gallery.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-600">No gallery packages found</div>
              )}
            </div>
            {galleryHasNext && (
              <button
                className="mt-2 w-full rounded bg-surface px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50"
                disabled={galleryLoading}
                onClick={loadMoreGallery}
              >
                {galleryLoading ? "Loading" : "Load more"}
              </button>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            className="rounded px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200"
            onClick={() => onClose()}
          >
            Cancel
          </button>
          <button
            className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent/80 disabled:opacity-50"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
