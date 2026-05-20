import { cn } from "@/lib/utils"
import React from "react"

export interface LoaderProps {
  variant?: "circular" | "dots" | "typing" | "wave" | "text-shimmer" | "loading-dots"
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
}

export function CircularLoader({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "size-4", md: "size-5", lg: "size-6" }
  return (
    <div className={cn("border-primary animate-spin rounded-full border-2 border-t-transparent", sizeClasses[size], className)}>
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function DotsLoader({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dotSizes = { sm: "h-1.5 w-1.5", md: "h-2 w-2", lg: "h-2.5 w-2.5" }
  const containerSizes = { sm: "h-4", md: "h-5", lg: "h-6" }
  return (
    <div className={cn("flex items-center space-x-1", containerSizes[size], className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn("bg-muted-foreground animate-bounce rounded-full", dotSizes[size])}
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function TypingLoader({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dotSizes = { sm: "h-1 w-1", md: "h-1.5 w-1.5", lg: "h-2 w-2" }
  const containerSizes = { sm: "h-4", md: "h-5", lg: "h-6" }
  return (
    <div className={cn("flex items-center space-x-1", containerSizes[size], className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn("bg-muted-foreground animate-bounce rounded-full", dotSizes[size])}
          style={{ animationDelay: `${i * 250}ms` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function WaveLoader({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const barWidths = { sm: "w-0.5", md: "w-0.5", lg: "w-1" }
  const containerSizes = { sm: "h-4", md: "h-5", lg: "h-6" }
  const heights: Record<string, string[]> = {
    sm: ["6px", "9px", "12px", "9px", "6px"],
    md: ["8px", "12px", "16px", "12px", "8px"],
    lg: ["10px", "15px", "20px", "15px", "10px"],
  }
  return (
    <div className={cn("flex items-center gap-0.5", containerSizes[size], className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn("bg-muted-foreground animate-bounce rounded-full", barWidths[size])}
          style={{ animationDelay: `${i * 100}ms`, height: heights[size][i] }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function TextShimmerLoader({ text = "Thinking", className, size = "md" }: { text?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const textSizes = { sm: "text-xs", md: "text-sm", lg: "text-base" }
  return (
    <div className={cn("animate-pulse font-medium text-muted-foreground", textSizes[size], className)}>
      {text}
    </div>
  )
}

export function TextDotsLoader({ text = "Thinking", className, size = "md" }: { text?: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const textSizes = { sm: "text-xs", md: "text-sm", lg: "text-base" }
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      <span className={cn("font-medium text-muted-foreground", textSizes[size])}>{text}</span>
      <span className="flex">
        {[0, 1, 2].map((i) => (
          <span key={i} className="animate-bounce text-muted-foreground" style={{ animationDelay: `${i * 200}ms` }}>.</span>
        ))}
      </span>
    </div>
  )
}

function Loader({ variant = "circular", size = "md", text, className }: LoaderProps) {
  switch (variant) {
    case "circular": return <CircularLoader size={size} className={className} />
    case "dots": return <DotsLoader size={size} className={className} />
    case "typing": return <TypingLoader size={size} className={className} />
    case "wave": return <WaveLoader size={size} className={className} />
    case "text-shimmer": return <TextShimmerLoader text={text} size={size} className={className} />
    case "loading-dots": return <TextDotsLoader text={text} size={size} className={className} />
    default: return <CircularLoader size={size} className={className} />
  }
}

export { Loader }
