import { cn } from "@/lib/utils"
import React, { useEffect, useState } from "react"
import { codeToHtml } from "shiki"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "my-1 flex w-full flex-col overflow-clip rounded-lg border border-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "text",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function highlight() {
      if (!code) {
        setHighlightedHtml("")
        return
      }
      try {
        const html = await codeToHtml(code, {
          lang: language,
          themes: { light: "github-light", dark: "github-dark" },
        })
        if (!cancelled) setHighlightedHtml(html)
      } catch {
        try {
          const html = await codeToHtml(code, {
            lang: "text",
            themes: { light: "github-light", dark: "github-dark" },
          })
          if (!cancelled) setHighlightedHtml(html)
        } catch {
          if (!cancelled) setHighlightedHtml(null)
        }
      }
    }
    highlight()
    return () => { cancelled = true }
  }, [code, language])

  const classNames = cn(
    "w-full overflow-x-auto text-sm [&>pre]:px-3 [&>pre]:py-2 [&>pre]:leading-relaxed",
    className
  )

  return highlightedHtml !== null ? (
    <div
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div className={classNames} {...props}>
      <pre className="bg-[#f6f8fa] px-4 py-3.5 dark:bg-[#0d1117]">
        <code className="font-mono text-[#24292e] dark:text-[#e6edf3]">{code}</code>
      </pre>
    </div>
  )
}

export type CodeBlockHeaderProps = {
  language?: string
  filename?: string
  children?: React.ReactNode
  className?: string
}

function CodeBlockHeader({ language, filename, children, className }: CodeBlockHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border/50 bg-muted/40 px-3 py-1",
        className
      )}
    >
      {filename && <span className="text-xs text-muted-foreground">{filename}</span>}
      {language && !filename && (
        <span className="text-xs text-muted-foreground/70">{language}</span>
      )}
      {children}
    </div>
  )
}

export type DiffCodeBlockProps = {
  code: string
  className?: string
}

function DiffCodeBlock({ code, className }: DiffCodeBlockProps) {
  const lines = code.split("\n")
  return (
    <div className={cn("w-full overflow-x-auto text-sm", className)}>
      <pre className="py-2 leading-relaxed">
        {lines.map((line, i) => {
          const isAdd = line.startsWith("+") && !line.startsWith("+++")
          const isDel = line.startsWith("-") && !line.startsWith("---")
          const isHunk = line.startsWith("@@")
          return (
            <div
              key={i}
              className={cn(
                "px-3",
                isAdd && "bg-green-500/15 text-green-700 dark:text-green-400",
                isDel && "bg-red-500/15 text-red-700 dark:text-red-400",
                isHunk && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                !isAdd && !isDel && !isHunk && "text-foreground",
              )}
            >
              <code className="font-mono">{line || " "}</code>
            </div>
          )
        })}
      </pre>
    </div>
  )
}

export { CodeBlock, CodeBlockCode, CodeBlockHeader, DiffCodeBlock }
