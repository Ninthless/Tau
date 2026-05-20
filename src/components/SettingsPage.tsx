import { useEffect, useMemo, useState } from "react"
import type {
  AppSettings, AuthProviderInfo, AvailableModel,
  PiPackageGalleryItem, PiPackageGallerySort, PiPackageGalleryType,
  PiPackageInfo, PiPackageProgress, RuntimeSettings,
} from "../types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  ArrowLeftIcon, KeyRoundIcon, FolderIcon,
  SlidersHorizontalIcon, PackageIcon,
} from "lucide-react"

type Section = "models" | "workspace" | "runtime" | "packages"

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "models",    label: "模型与密钥", icon: KeyRoundIcon },
  { id: "workspace", label: "工作区",     icon: FolderIcon },
  { id: "runtime",   label: "运行时",     icon: SlidersHorizontalIcon },
  { id: "packages",  label: "扩展包",     icon: PackageIcon },
]

const RUNTIME_TOGGLES: [keyof RuntimeSettings, string, string][] = [
  ["showImages",             "显示图片",       "在聊天中渲染图片附件"],
  ["imageAutoResize",        "自动缩放图片",   "发送前自动缩小大尺寸图片"],
  ["blockImages",            "阻止发送图片",   "阻止向模型发送任何图片"],
  ["autoCompaction",         "自动压缩上下文", "上下文接近限制时自动压缩"],
  ["autoRetry",              "自动重试",       "请求失败时自动重试"],
  ["hideThinkingBlock",      "隐藏思考块",     "不显示模型的思考过程"],
  ["quietStartup",           "静默启动",       "启动时不显示欢迎信息"],
  ["collapseChangelog",      "折叠更新日志",   "默认折叠更新日志条目"],
  ["enableInstallTelemetry", "安装遥测",       "向 pi.dev 发送匿名安装统计"],
]

type SelectOption<T extends string> = { label: string; value: T }

interface Props {
  onBack: () => void
  sidebarOpen: boolean
}

export function SettingsPage({ onBack, sidebarOpen }: Props) {
  const [section, setSection] = useState<Section>("models")
  const [settings, setSettings] = useState<AppSettings>({ apiKeys: {}, defaultCwd: "." })
  const [models, setModels] = useState<AvailableModel[]>([])
  const [authProviders, setAuthProviders] = useState<AuthProviderInfo[]>([])
  const [modelSearch, setModelSearch] = useState("")
  const [selectedModel, setSelectedModel] = useState<AvailableModel | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const [modelSaving, setModelSaving] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
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
    const [providers, updatedModels, state] = await Promise.all([
      window.piAgent.getAuthProviders(),
      window.piAgent.getModels(),
      window.piAgent.getState(),
    ])
    setAuthProviders(providers)
    setModels(updatedModels)
    const current = updatedModels.find(
      (m) => m.provider === state.model?.provider && m.id === state.model.id
    )
    setSelectedModel((prev) =>
      prev
        ? updatedModels.find((m) => m.provider === prev.provider && m.id === prev.id) ?? current ?? null
        : current ?? updatedModels.find((m) => m.default) ?? null
    )
  }

  const refreshPackages = async () => setPackages(await window.piAgent.getPackages())

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
      const current = m.find((x) => x.id === state.model?.id && x.provider === state.model.provider)
      setSelectedModel(current ?? m.find((x) => x.default) ?? null)
    }).catch(() => {})
    const unsub = window.piAgent.onPackageProgress((e) => setPackageProgress(e))
    return unsub
  }, [])

  const filteredModels = useMemo(() => {
    const q = modelSearch.toLowerCase()
    return models
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 50)
  }, [models, modelSearch])

  const saveKey = async (provider: string, key: string) => {
    setSavingKey(provider)
    try { await window.piAgent.setApiKey(provider, key); await refreshAuthAndModels() }
    finally { setSavingKey(null) }
  }

  const applyModel = async () => {
    if (!selectedModel) return
    setModelSaving(true); setModelError(null)
    try {
      const result = await window.piAgent.setModel(selectedModel.provider, selectedModel.id)
      if (!result.ok) setModelError(`${selectedModel.provider} 未配置 API Key`)
    } finally { setModelSaving(false) }
  }

  const saveRuntime = async <K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) => {
    const next = runtimeSettings ? { ...runtimeSettings, [key]: value } : null
    if (!next) return
    setRuntimeSettings(next)
    await window.piAgent.setRuntimeSettings({ [key]: value })
  }

  const runPackageAction = async (label: string, action: () => Promise<void>) => {
    setPackageBusy(label); setPackageError(null)
    try { await action(); await Promise.all([refreshPackages(), refreshAuthAndModels()]) }
    catch (err) { setPackageError(err instanceof Error ? err.message : String(err)) }
    finally { setPackageBusy(null) }
  }

  const installPackage = async (source = packageSource) => {
    const s = source.trim(); if (!s) return
    await runPackageAction(`install:${s}`, async () => { await window.piAgent.installPackage(s, packageLocal); setPackageSource("") })
  }

  const loadGallery = async (page = 1, append = false) => {
    setGalleryLoading(true); setPackageError(null)
    try {
      const result = await window.piAgent.searchPackageGallery(galleryQuery, page, galleryType, gallerySort)
      setGallery((prev) => append ? [...prev, ...result.items] : result.items)
      setGalleryPage(result.page); setGalleryTotal(result.total); setGalleryHasNext(result.hasNext)
    } catch (err) { setPackageError(err instanceof Error ? err.message : String(err)) }
    finally { setGalleryLoading(false) }
  }

  const getAuthLabel = (p: AuthProviderInfo) => {
    if (p.storedType === "oauth") return "subscription"
    if (p.storedType === "api_key") return "stored key"
    if (p.source === "environment") return p.label ? `env: ${p.label}` : "environment"
    return "not configured"
  }

  const steeringOptions: SelectOption<RuntimeSettings["steeringMode"]>[] = [
    { label: "one-at-a-time", value: "one-at-a-time" },
    { label: "all", value: "all" },
  ]
  const followUpOptions: SelectOption<RuntimeSettings["followUpMode"]>[] = [
    { label: "one-at-a-time", value: "one-at-a-time" },
    { label: "all", value: "all" },
  ]
  const transportOptions: SelectOption<RuntimeSettings["transport"]>[] = [
    { label: "auto", value: "auto" },
    { label: "sse", value: "sse" },
    { label: "websocket", value: "websocket" },
  ]

  return (
    <div className="flex h-full w-full overflow-hidden">
      {sidebarOpen && (
        <aside className="flex h-full w-[312px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
          <button
            className="flex h-10 items-center gap-2 border-b border-sidebar-border px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground app-region-no-drag"
            onClick={onBack}
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
            返回应用
          </button>
          <nav className="flex flex-col gap-0.5 p-2">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                  section === id
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                onClick={() => setSection(id)}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
        </aside>
      )}

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-2xl px-8 py-8">

          {section === "models" && (
            <div className="flex flex-col gap-8">
              <SectionHeading title="模型与密钥" description="配置 API Key 并选择默认模型" />

              <div className="flex flex-col gap-3">
                <SubHeading title="API Keys" description="各 provider 的访问凭证" />
                <div className="divide-y divide-border border-t border-b">
                  {authProviders.filter((p) => p.authType === "api_key").map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-36 shrink-0 truncate text-sm" title={p.id}>{p.name}</span>
                      <Input
                        type="password"
                        placeholder={getAuthLabel(p)}
                        defaultValue={settings.apiKeys[p.id] ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim()
                          if (val !== (settings.apiKeys[p.id] ?? "")) saveKey(p.id, val)
                        }}
                        className="h-7 flex-1 text-xs"
                      />
                      <StatusDot configured={p.configured} label={savingKey === p.id ? "saving…" : getAuthLabel(p)} />
                    </div>
                  ))}
                </div>
                {authProviders.some((p) => p.authType === "oauth") && (
                  <div className="divide-y divide-border border-t border-b">
                    <div className="px-4 py-2 text-xs font-medium text-muted-foreground">Subscriptions</div>
                    {authProviders.filter((p) => p.authType === "oauth").map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">{p.name}</span>
                        <StatusDot configured={p.configured} label={getAuthLabel(p)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <SubHeading title="模型" description={`${models.length} 个可用模型`} />
                <Input type="search" placeholder="搜索模型…" value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} />
                <ScrollArea className="h-52">
                  <div className="flex flex-col border-t border-b divide-y divide-border">
                    {filteredModels.map((m) => (
                      <button
                        key={`${m.provider}/${m.id}`}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent",
                          selectedModel?.id === m.id && selectedModel?.provider === m.provider
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground"
                        )}
                        onClick={() => { if (m.hasAuth) { setSelectedModel(m); setModelError(null) } }}
                        disabled={!m.hasAuth}
                      >
                        <span className={cn("truncate", !m.hasAuth && "opacity-40")}>{m.id}</span>
                        <span className="shrink-0 text-xs text-muted-foreground/70">
                          {m.providerName}{m.reasoning ? " · reasoning" : ""}{m.current ? " · current" : m.default ? " · default" : ""}
                        </span>
                      </button>
                    ))}
                    {filteredModels.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">无匹配模型</p>}
                  </div>
                </ScrollArea>
                {selectedModel && !modelError && (
                  <p className="text-sm text-muted-foreground">
                    {selectedModel.name} · {selectedModel.providerName}
                    {selectedModel.contextWindow > 0 && ` · ${(selectedModel.contextWindow / 1000).toFixed(0)}k ctx`}
                  </p>
                )}
                {modelError && <p className="text-sm text-destructive">{modelError}</p>}
                <Button className="self-start" disabled={modelSaving || !selectedModel} onClick={applyModel}>
                  应用模型
                </Button>
              </div>
            </div>
          )}

          {section === "workspace" && (
            <div className="flex flex-col gap-6">
              <SectionHeading title="工作区" description="新会话的默认工作目录" />
              <div className="flex flex-col gap-2">
                <Label>默认工作目录</Label>
                <Input
                  type="text"
                  placeholder="/path/to/project"
                  value={settings.defaultCwd}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultCwd: e.target.value }))}
                  onBlur={async () => { await window.piAgent.setSettings({ defaultCwd: settings.defaultCwd }) }}
                />
                <p className="text-xs text-muted-foreground">失去焦点时自动保存</p>
              </div>
            </div>
          )}

          {section === "runtime" && runtimeSettings && (
            <div className="flex flex-col gap-8">
              <SectionHeading title="运行时" description="本地 Pi 执行行为偏好" />
              <div className="divide-y divide-border border-t border-b">
                {RUNTIME_TOGGLES.map(([key, label, desc]) => (
                  <label key={key} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium leading-none">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                    <Switch
                      checked={Boolean(runtimeSettings[key])}
                      onCheckedChange={(v) => saveRuntime(key, v)}
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <SubHeading title="高级" />
                <div className="flex flex-col gap-4">
                  <LabeledSelect label="Steering" value={runtimeSettings.steeringMode} options={steeringOptions} onChange={(v) => saveRuntime("steeringMode", v)} />
                  <LabeledSelect label="Follow-up" value={runtimeSettings.followUpMode} options={followUpOptions} onChange={(v) => saveRuntime("followUpMode", v)} />
                  <LabeledSelect label="Transport" value={runtimeSettings.transport} options={transportOptions} onChange={(v) => saveRuntime("transport", v)} />
                </div>
              </div>
            </div>
          )}

          {section === "packages" && (
            <div className="flex flex-col gap-8">
              <SectionHeading title="扩展包" description={`${packages.length} 个已配置`} />
              <div className="flex flex-col gap-3">
                <SubHeading title="安装" />
                <div className="flex flex-col gap-3">
                  <Input
                    type="text"
                    placeholder="npm:package、git:github.com/user/repo 或本地路径"
                    value={packageSource}
                    onChange={(e) => setPackageSource(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") installPackage() }}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <Switch checked={packageLocal} onCheckedChange={setPackageLocal} />
                      本地安装
                    </label>
                    <Button disabled={!!packageBusy || !packageSource.trim()} onClick={() => installPackage()}>安装</Button>
                  </div>
                  {packageProgress && (
                    <p className="truncate text-sm text-muted-foreground">
                      {packageProgress.action} {packageProgress.source}: {packageProgress.message ?? packageProgress.type}
                    </p>
                  )}
                  {packageError && <p className="text-sm text-destructive">{packageError}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <SubHeading title="已安装" />
                <div className="border-t border-b">
                  {packages.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">暂无已安装扩展包</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {packages.map((pkg) => (
                        <div key={`${pkg.scope}:${pkg.source}`} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{pkg.source}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {pkg.scope}{pkg.filtered ? " · filtered" : ""}{pkg.installedPath ? ` · ${pkg.installedPath}` : " · not installed"}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" disabled={!!packageBusy} onClick={() => runPackageAction(`update:${pkg.source}`, () => window.piAgent.updatePackage(pkg.source))}>更新</Button>
                          <Button variant="destructive" size="sm" disabled={!!packageBusy} onClick={() => runPackageAction(`remove:${pkg.source}:${pkg.scope}`, () => window.piAgent.removePackage(pkg.source, pkg.scope === "project"))}>移除</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-border px-4 py-3">
                    <Button variant="secondary" size="sm" disabled={!!packageBusy} onClick={() => runPackageAction("update:all", () => window.piAgent.updatePackage())}>全部更新</Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <SubHeading title="扩展包市场" />
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Input type="search" placeholder="搜索 pi.dev 扩展包" value={galleryQuery} onChange={(e) => setGalleryQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loadGallery(1) }} className="flex-1" />
                    <SettingsSelect label="类型" value={galleryType} options={[{ label: "全部", value: "" }, { label: "extension", value: "extension" }, { label: "skill", value: "skill" }, { label: "theme", value: "theme" }, { label: "prompt", value: "prompt" }]} onChange={setGalleryType} />
                    <SettingsSelect label="排序" value={gallerySort} options={[{ label: "下载量", value: "downloads" }, { label: "最新", value: "recent" }, { label: "A-Z", value: "name" }]} onChange={setGallerySort} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button disabled={galleryLoading} onClick={() => loadGallery(1)}>搜索</Button>
                    <span className="flex-1 text-right text-xs text-muted-foreground">
                      {galleryTotal === null ? `${gallery.length} 条` : `${gallery.length} / ${galleryTotal} 条`}
                    </span>
                  </div>
                  <ScrollArea className="h-52">
                    <div className="flex flex-col border-t border-b divide-y divide-border">
                      {gallery.map((item) => (
                        <button key={`${item.href}:${item.source}`} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent" onClick={() => setPackageSource(item.source)}>
                          <div className="min-w-0 flex-1">
                            <div className="truncate">{item.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                            <div className="truncate text-xs text-muted-foreground">{[item.author, item.downloadsLabel, item.types.join(", ")].filter(Boolean).join(" · ")}</div>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">{item.published ?? ""}</span>
                        </button>
                      ))}
                      {gallery.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">无结果</p>}
                    </div>
                  </ScrollArea>
                  {galleryHasNext && <Button variant="secondary" className="w-full" disabled={galleryLoading} onClick={() => loadGallery(galleryPage + 1, true)}>加载更多</Button>}
                </div>
              </div>
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1 pb-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

function SubHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

function StatusDot({ configured, label }: { configured: boolean; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <div className={cn("size-1.5 rounded-full", configured ? "bg-emerald-500" : "bg-muted-foreground/30")} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function SettingsSelect<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
}) {
  const toI = (v: string) => v === "" ? "__all__" : v
  const toE = (v: string) => (v === "__all__" ? "" : v) as T
  return (
    <Select value={toI(value)} onValueChange={(v) => onChange(toE(v))}>
      <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={toI(o.value)} value={toI(o.value)}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function LabeledSelect<T extends string>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
}) {
  const toI = (v: string) => v === "" ? "__all__" : v
  const toE = (v: string) => (v === "__all__" ? "" : v) as T
  return (
    <div className="flex items-center gap-4">
      <Label className="w-28 shrink-0 text-sm">{label}</Label>
      <Select value={toI(value)} onValueChange={(v) => onChange(toE(v))}>
        <SelectTrigger className="flex-1"><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={toI(o.value)} value={toI(o.value)}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
