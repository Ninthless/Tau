import { useState } from "react"
import { Markdown } from "./prompt-kit/markdown"
import { TextShimmer } from "./prompt-kit/text-shimmer"
import { Tool } from "./prompt-kit/tool"
import { ChatContainerRoot, ChatContainerContent } from "./prompt-kit/chat-container"
import { ScrollButton } from "./prompt-kit/scroll-button"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"
import type { ChatMessage } from "../types"

interface Props {
  messages: ChatMessage[]
}

export function MessageList({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm rounded-xl border border-dashed border-border px-8 py-10 text-center">
          <div className="mb-1.5 text-sm font-medium text-foreground">Start a Tau session</div>
          <div className="text-xs text-muted-foreground">
            Send a prompt, run a Pi command, or install an extension package from settings.
          </div>
        </div>
      </div>
    )
  }

  return (
    <ChatContainerRoot className="min-w-0 flex-1">
      <ChatContainerContent className="gap-2 px-4 py-3 pb-4">
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
      </ChatContainerContent>
      <ScrollButton />
    </ChatContainerRoot>
  )
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      {message.blocks.map((block, i) => {
        if (block.type === "text") {
          return isUser ? (
            <div
              key={i}
              className="max-w-[80%] rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-foreground"
            >
              {block.text}
            </div>
          ) : (
            <div key={i} className="w-full">
              <Markdown>{block.text}</Markdown>
            </div>
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

        return null
      })}
    </div>
  )
}

function ThinkingBlockRow({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full border-l-2 border-border pl-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 py-0.5 text-left transition-opacity hover:opacity-80"
        onClick={() => setOpen((o) => !o)}
      >
        <TextShimmer className="text-xs font-medium">Thinking</TextShimmer>
        {open
          ? <ChevronDownIcon className="ml-auto size-3.5 text-muted-foreground" />
          : <ChevronRightIcon className="ml-auto size-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="whitespace-pre-wrap pb-1.5 pt-0.5 text-[11px] text-muted-foreground">
          {text}
        </div>
      )}
    </div>
  )
}
