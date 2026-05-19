import { useState } from "react"
import type { ToolCallBlock } from "../types"

interface Props {
  block: ToolCallBlock
}

export function ToolBlock({ block }: Props) {
  const [collapsed, setCollapsed] = useState(block.collapsed)

  const statusColor =
    block.status === "running"
      ? "text-yellow-400"
      : block.status === "error"
      ? "text-red-400"
      : "text-green-400"

  const statusIcon =
    block.status === "running" ? "⟳" : block.status === "error" ? "✗" : "✓"

  const argsPreview = Object.entries(block.args)
    .slice(0, 2)
    .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 40)}`)
    .join(" ")

  return (
    <div className="my-1 rounded border border-border bg-panel text-xs font-mono">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className={statusColor}>{statusIcon}</span>
        <span className="font-semibold text-accent">{block.label}</span>
        {argsPreview && (
          <span className="truncate text-gray-500">{argsPreview}</span>
        )}
        <span className="ml-auto text-gray-600">{collapsed ? "▸" : "▾"}</span>
      </button>

      {!collapsed && (block.result !== undefined || block.partialResult) && (
        <div className="max-h-48 overflow-y-auto border-t border-border px-3 py-2 text-gray-400 whitespace-pre-wrap">
          {(block.result ?? block.partialResult ?? "").slice(0, 2000)}
          {(block.result ?? block.partialResult ?? "").length > 2000 && (
            <span className="text-gray-600"> …truncated</span>
          )}
        </div>
      )}
    </div>
  )
}
