import { useCallback, useEffect, useMemo, useState } from "react"
import type { ComponentType, SVGProps } from "react"
import type { SessionInfo } from "../types"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  MessageSquarePlusIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

interface Props {
  onNewSession: (cwd: string) => void
  onSwitchSession: (path: string) => void
  onOpenSettings: () => void
  currentSessionId: string
  externalCwd?: string
}

type ProjectGroup = {
  cwd: string
  name: string
  sessions: SessionInfo[]
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function displaySessionTitle(session: SessionInfo) {
  return session.firstMessage?.trim() || session.id.slice(0, 8)
}

function projectName(cwd: string) {
  const normalized = cwd.replace(/[\\/]+$/, "")
  const parts = normalized.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || "Untitled"
}

export function Sidebar({ onNewSession, onSwitchSession, onOpenSettings, currentSessionId, externalCwd }: Props) {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [projectCwds, setProjectCwds] = useState<string[]>([])
  const [currentCwd, setCurrentCwd] = useState("")
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    const [settings, allSessions] = await Promise.all([
      window.piAgent.getSettings(),
      window.piAgent.listAllSessions(),
    ])
    const cwds = new Set<string>()
    for (const cwd of settings.projectCwds ?? []) {
      if (cwd.trim()) cwds.add(cwd)
    }
    if (settings.defaultCwd?.trim()) cwds.add(settings.defaultCwd)
    for (const session of allSessions) {
      if (session.cwd?.trim()) cwds.add(session.cwd)
    }
    setCurrentCwd(settings.defaultCwd || ".")
    setProjectCwds([...cwds])
    setSessions(allSessions)
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      setSessions([])
      setProjectCwds([])
    })
  }, [refresh, currentSessionId])

  useEffect(() => {
    if (!externalCwd) return
    setCurrentCwd(externalCwd)
    setProjectCwds((prev) => prev.includes(externalCwd) ? prev : [externalCwd, ...prev])
  }, [externalCwd])

  const projectGroups = useMemo<ProjectGroup[]>(() => {
    return projectCwds
      .map((cwd) => ({
        cwd,
        name: projectName(cwd),
        sessions: sessions
          .filter((s) => s.cwd === cwd)
          .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()),
      }))
      .sort((a, b) => {
        const aTime = new Date(a.sessions[0]?.modified ?? 0).getTime()
        const bTime = new Date(b.sessions[0]?.modified ?? 0).getTime()
        return bTime - aTime
      })
  }, [projectCwds, sessions])

  const looseSessions = useMemo(() => {
    const projectSet = new Set(projectCwds)
    return sessions
      .filter((s) => !s.cwd || !projectSet.has(s.cwd))
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
  }, [projectCwds, sessions])

  const addProjectFromFolder = async () => {
    const cwd = await window.piAgent.selectDirectory()
    if (!cwd) return
    const next = projectCwds.includes(cwd) ? projectCwds : [cwd, ...projectCwds]
    setProjectCwds(next)
    setCurrentCwd(cwd)
    await window.piAgent.setSettings({ defaultCwd: cwd, projectCwds: next })
    await onNewSession(cwd)
    await refresh()
  }

  const removeProject = async (cwd: string) => {
    const next = projectCwds.filter((c) => c !== cwd)
    setProjectCwds(next)
    await window.piAgent.setSettings({ projectCwds: next })
  }

  const createSessionInProject = async (cwd: string) => {
    await onNewSession(cwd)
    await refresh()
  }

  const createLooseSession = async () => {
    await onNewSession(currentCwd || ".")
    await refresh()
  }

  const toggleCollapse = (cwd: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(cwd)) next.delete(cwd)
      else next.add(cwd)
      return next
    })
  }

  const handleDeleteSession = async (path: string) => {
    await window.piAgent.deleteSession(path).catch(() => {})
    await refresh()
  }

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-2 py-2">
        <SidebarAction icon={MessageSquarePlusIcon} label="新对话" onClick={createLooseSession} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <SectionHeader label="项目" onAddFolder={addProjectFromFolder} />

        <div className="flex flex-col gap-2">
          {projectGroups.map((project) => (
            <div key={project.cwd} className="flex flex-col gap-0.5">
              <ProjectHeader
                name={project.name}
                cwd={project.cwd}
                collapsed={collapsedProjects.has(project.cwd)}
                onToggle={() => toggleCollapse(project.cwd)}
                onNewSession={() => createSessionInProject(project.cwd)}
                onRemove={() => removeProject(project.cwd)}
              />
              {!collapsedProjects.has(project.cwd) && (
                project.sessions.length > 0 ? (
                  project.sessions.map((session) => (
                    <SessionRow
                      key={session.path}
                      active={session.id === currentSessionId}
                      indent
                      session={session}
                      onClick={() => onSwitchSession(session.path)}
                      onDelete={() => handleDeleteSession(session.path)}
                    />
                  ))
                ) : (
                  <button
                    className="ml-6 flex h-7 items-center rounded-md px-2 text-left text-xs text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={() => createSessionInProject(project.cwd)}
                  >
                    新建对话
                  </button>
                )
              )}
            </div>
          ))}
        </div>

        {looseSessions.length > 0 && (
          <div className="mt-3 flex flex-col gap-0.5">
            <div className="px-1.5 pb-1 text-xs font-medium text-sidebar-foreground/40">对话</div>
            {looseSessions.map((session) => (
              <SessionRow
                key={session.path}
                active={session.id === currentSessionId}
                session={session}
                onClick={() => onSwitchSession(session.path)}
                onDelete={() => handleDeleteSession(session.path)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        className="mx-2 mb-2 flex h-8 items-center gap-2 rounded-md px-2 text-xs text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={onOpenSettings}
      >
        <SettingsIcon className="size-3.5 shrink-0" aria-hidden="true" />
        设置
      </button>
    </aside>
  )
}

function SidebarAction({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        disabled && "pointer-events-none opacity-40"
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

function SectionHeader({ label, onAddFolder }: { label: string; onAddFolder: () => void }) {
  return (
    <div className="sticky top-0 z-10 flex h-8 items-center justify-between bg-sidebar">
      <span className="px-1.5 text-xs font-medium text-sidebar-foreground/40">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="flex size-6 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={onAddFolder}
          >
            <FolderPlusIcon className="size-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">添加文件夹</TooltipContent>
      </Tooltip>
    </div>
  )
}

function ProjectHeader({
  name, cwd, collapsed, onToggle, onNewSession, onRemove,
}: {
  name: string
  cwd: string
  collapsed: boolean
  onToggle: () => void
  onNewSession: () => void
  onRemove: () => void
}) {
  return (
    <div
      className="group flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/70"
      title={cwd}
      onClick={onToggle}
    >
      <ChevronRightIcon
        className={cn("size-3 shrink-0 transition-transform duration-150", !collapsed && "rotate-90")}
        aria-hidden="true"
      />
      <FolderIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
      <div
        className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-5 items-center justify-center rounded text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={onNewSession}
            >
              <PlusIcon className="size-3" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">新建对话</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-5 items-center justify-center rounded text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={onRemove}
            >
              <XIcon className="size-3" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">从侧边栏移除</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function SessionRow({
  session, active, indent, onClick, onDelete,
}: {
  session: SessionInfo
  active: boolean
  indent?: boolean
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        "group flex h-7 w-full items-center gap-1 rounded-md px-2 transition-colors",
        indent && "ml-5 w-[calc(100%-1.25rem)]",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <button
        className="min-w-0 flex-1 truncate text-left text-xs font-medium"
        onClick={onClick}
        title={displaySessionTitle(session)}
      >
        {displaySessionTitle(session)}
      </button>
      <span className="shrink-0 text-xs text-sidebar-foreground/30 group-hover:hidden">
        {formatRelativeTime(session.modified)}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="hidden size-5 shrink-0 items-center justify-center rounded text-sidebar-foreground/40 hover:text-destructive group-hover:flex"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            <Trash2Icon className="size-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">删除对话</TooltipContent>
      </Tooltip>
    </div>
  )
}
