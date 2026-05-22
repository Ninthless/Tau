import { useStickToBottomContext } from "use-stick-to-bottom"
import { ArrowDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScrollButtonProps {
  className?: string
}

export function ScrollButton({ className }: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  if (isAtBottom) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
      <button
        type="button"
        onClick={() => scrollToBottom()}
        className={cn(
          "pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground",
          className
        )}
      >
        <ArrowDownIcon className="size-3" />
        Scroll to bottom
      </button>
    </div>
  )
}
