import { StickToBottom } from "use-stick-to-bottom"
import { cn } from "@/lib/utils"

interface ChatContainerRootProps {
  children: React.ReactNode
  className?: string
}

export function ChatContainerRoot({ children, className }: ChatContainerRootProps) {
  return (
    <StickToBottom
      className={cn("relative min-h-0 min-w-0 flex-1 overflow-hidden", className)}
      resize="instant"
      initial="instant"
    >
      {children}
    </StickToBottom>
  )
}

interface ChatContainerContentProps {
  children: React.ReactNode
  className?: string
}

export function ChatContainerContent({ children, className }: ChatContainerContentProps) {
  return (
    <StickToBottom.Content className={cn("flex flex-col", className)}>
      {children}
    </StickToBottom.Content>
  )
}
