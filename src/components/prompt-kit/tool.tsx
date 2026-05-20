import { useState } from "react"
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { Loader } from "./loader"
import type { ToolCallBlock } from "../../types"

function ToolStatusIcon({ status }: { status: ToolCallBlock["status"] }) {
  if (status === "running") {
    return <Loader variant="dots" size="sm" className="shrink-0" />
  }
  if (status === "error") {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive/15">
        <XIcon className="size-2.5 text-destructive" />
      </span>
    )
  }
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15">
      <CheckIcon className="size-2.5 text-success-foreground" />
    </span>
  )
}

interface ToolProps {
  block: ToolCallBlock
}

export function Tool({ block }: ToolProps) {
  const [open, setOpen] = useState(!block.collapsed)

  const argsPreview = Object.entries(block.args)
    .slice(0, 2)
    .map(([k, v]) => {
      const val = typeof v === "string" ? v : JSON.stringify(v)
      return `${k}=${val.slice(0, 36)}`
    })
    .join("  ")

  const resultText = block.result ?? block.partialResult ?? ""

  return (
    <div className="w-full border-l-2 border-border pl-3 text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 py-1.5 text-left transition-opacity hover:opacity-80"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ToolStatusIcon status={block.status} />

        <span className="font-medium text-foreground">{block.label}</span>

        {argsPreview && !open && (
          <span className="truncate font-mono text-muted-foreground/60">{argsPreview}</span>
        )}

        <span className="ml-auto shrink-0 text-muted-foreground">
          {open
            ? <ChevronDownIcon className="size-3.5" />
            : <ChevronRightIcon className="size-3.5" />}
        </span>
      </button>

      {open && (
        <div className="pb-2 pt-1">
          {Object.keys(block.args).length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Input</div>
              <div className="space-y-0.5 font-mono">
                {Object.entries(block.args).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground">{k}</span>
                    <span className="truncate text-foreground/70">
                      {typeof v === "string" ? v.slice(0, 120) : JSON.stringify(v).slice(0, 120)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultText && (
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">Output</div>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-muted-foreground/80">
                {resultText.slice(0, 2000)}
                {resultText.length > 2000 && (
                  <span className="text-muted-foreground/40"> …truncated</span>
                )}
              </pre>
            </div>
          )}

          {block.status === "running" && !resultText && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader variant="dots" size="sm" />
              <span>Running…</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
