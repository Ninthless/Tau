import { useState } from "react"
import { Markdown } from "./prompt-kit/markdown"
import { TextShimmer } from "./prompt-kit/text-shimmer"
import { Tool } from "./prompt-kit/tool"
import { ChatContainerRoot, ChatContainerContent } from "./prompt-kit/chat-container"
import { ScrollButton } from "./prompt-kit/scroll-button"
import { AlertCircleIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon, PackageIcon, RefreshCwIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "../types"

interface Props {
  messages: ChatMessage[]
  isRetrying?: boolean
  isCompacting?: boolean
}

export function MessageList({ messages, isRetrying, isCompacting }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm rounded-xl border border-dashed border-border px-8 py-10 text-center">
          <div className="mb-2 text-sm font-medium text-foreground">Start a Tau session</div>
          <div className="text-xs text-muted-foreground">
            Send a prompt, run a Pi command, or install an extension package from settings.
          </div>
        </div>
      </div>
    )
  }

  return (
    <ChatContainerRoot className="min-w-0 flex-1">
      <ChatContainerContent className="gap-4 px-5 py-4 pb-6">
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        {isCompacting && (
          <div className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground">
            <PackageIcon className="size-3 shrink-0" />
            <TextShimmer>Compacting conversation history…</TextShimmer>
          </div>
        )}
        {isRetrying && !isCompacting && (
          <div className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground">
            <RefreshCwIcon className="size-3 shrink-0 animate-spin" />
            <TextShimmer>Retrying…</TextShimmer>
          </div>
        )}
      </ChatContainerContent>
      <ScrollButton />
    </ChatContainerRoot>
  )
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      {message.blocks.map((block, i) => {
        if (block.type === "text") {
          return isUser ? (
            <div
              key={i}
              className="max-w-[80%] rounded-lg border border-primary/20 bg-primary/10 px-3.5 py-2 text-sm text-foreground"
            >
              {block.text}
            </div>
          ) : (
            <AssistantTextRow key={i} text={block.text} />
          )
        }

        if (block.type === "image") {
          return (
            <img
              key={i}
              className="max-h-64 max-w-[80%] rounded-xl border border-border object-contain"
              src={`data:${block.mimeType};base64,${block.data}`}
              alt="attachment"
            />
          )
        }

        if (block.type === "thinking") {
          return <ThinkingBlockRow key={i} text={block.text} />
        }

        if (block.type === "tool_call") {
          return <Tool key={i} block={block} />
        }

        if (block.type === "error") {
          return (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
              <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>{block.message}</span>
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

function AssistantTextRow({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="group relative w-full">
      <Markdown>{text}</Markdown>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "absolute right-0 top-0 flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-foreground",
          copied && "opacity-100"
        )}
      >
        {copied
          ? <><CheckIcon className="size-2.5" />Copied</>
          : <><CopyIcon className="size-2.5" />Copy</>
        }
      </button>
    </div>
  )
}

function ThinkingBlockRow({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full border-l-2 border-border pl-3.5">
      <button
        type="button"
        className="flex w-full items-center gap-2 py-1 text-left transition-opacity hover:opacity-80"
        onClick={() => setOpen((o) => !o)}
      >
        <TextShimmer className="text-sm font-medium">Thinking</TextShimmer>
        {open
          ? <ChevronDownIcon className="ml-auto size-3.5 text-muted-foreground" />
          : <ChevronRightIcon className="ml-auto size-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="whitespace-pre-wrap pb-2 pt-1 text-xs text-muted-foreground">
          {text}
        </div>
      )}
    </div>
  )
}
