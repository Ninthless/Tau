import { useEffect, useState } from "react"
import { PanelLeftIcon, Minus, Square, Maximize2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { SessionStats } from "../types"

interface Props {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  sessionStats?: SessionStats | null
}

export function TitleBar({ sidebarOpen, onToggleSidebar, sessionStats }: Props) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.winControls.isMaximized().then(setIsMaximized).catch(() => {})
    const unsub = window.winControls.onMaximizeChange(setIsMaximized)
    return unsub
  }, [])

  const contextUsage = sessionStats?.contextUsage
  const contextPercent = contextUsage?.percent ?? null

  return (
    <div className="flex h-10 shrink-0 items-center border-b border-sidebar-border bg-sidebar app-region-drag">
      <div className="flex items-center app-region-no-drag">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              className={cn(
                "flex h-10 w-10 items-center justify-center transition-colors",
                sidebarOpen
                  ? "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
              onClick={onToggleSidebar}
            >
              <PanelLeftIcon className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{sidebarOpen ? "Hide sidebar" : "Show sidebar"}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-1 items-center justify-center px-4">
        {contextPercent !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 app-region-no-drag" aria-label={`Context usage: ${contextPercent}%`}>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-sidebar-accent">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      contextPercent >= 90 ? "bg-destructive" :
                      contextPercent >= 70 ? "bg-yellow-500" :
                      "bg-primary/50"
                    )}
                    style={{ width: `${Math.min(contextPercent, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{contextPercent}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {contextUsage?.tokens != null
                ? `Context: ${contextUsage.tokens.toLocaleString()} / ${contextUsage.contextWindow.toLocaleString()} tokens`
                : `Context usage: ${contextPercent}%`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center app-region-no-drag">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Minimize"
              className="flex h-10 w-11 items-center justify-center text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => window.winControls.minimize()}
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Minimize</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={isMaximized ? "Restore" : "Maximize"}
              className="flex h-10 w-11 items-center justify-center text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => window.winControls.maximize()}
            >
              {isMaximized
                ? <Maximize2 className="size-3" aria-hidden="true" />
                : <Square className="size-3" aria-hidden="true" />
              }
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{isMaximized ? "Restore" : "Maximize"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Close"
              className="flex h-10 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => window.winControls.close()}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
