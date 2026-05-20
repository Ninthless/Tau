import { useState } from "react"
import type { ToolCallBlock } from "../types"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, LoaderCircleIcon, XIcon } from "lucide-react"

interface Props {
  block: ToolCallBlock
}

export function ToolBlock({ block }: Props) {
  const [collapsed, setCollapsed] = useState(block.collapsed)

  const statusText =
    block.status === "running"
      ? "text-warning-foreground"
      : block.status === "error"
      ? "text-destructive-foreground"
      : "text-success-foreground"

  const StatusIcon =
    block.status === "running" ? LoaderCircleIcon : block.status === "error" ? XIcon : CheckIcon

  const argsPreview = Object.entries(block.args)
    .slice(0, 2)
    .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 40)}`)
    .join(" ")

  return (
    <div className="my-1 max-w-[86%] rounded-lg border border-border bg-card text-xs font-mono">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-accent"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Show tool result" : "Hide tool result"}
      >
        <span className={cn("flex shrink-0 items-center gap-1.5", statusText)}>
          <StatusIcon
            className={cn("size-3", block.status === "running" && "animate-spin")}
            aria-hidden="true"
          />
          {block.status}
        </span>
        <span className="font-semibold text-primary">{block.label}</span>
        {argsPreview && (
          <span className="truncate text-muted-foreground">{argsPreview}</span>
        )}
        <span className="ml-auto shrink-0 text-muted-foreground">
          {collapsed
            ? <ChevronRightIcon className="size-3" aria-hidden="true" />
            : <ChevronDownIcon className="size-3" aria-hidden="true" />}
        </span>
      </button>

      {!collapsed && (block.result !== undefined || block.partialResult) && (
        <div className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-border px-3 py-2 text-muted-foreground">
          {(block.result ?? block.partialResult ?? "").slice(0, 2000)}
          {(block.result ?? block.partialResult ?? "").length > 2000 && (
            <span className="text-muted-foreground/50"> …truncated</span>
          )}
        </div>
      )}
    </div>
  )
}
