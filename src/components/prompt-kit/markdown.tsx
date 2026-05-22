import { cn } from "@/lib/utils"
import { memo, useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode, CodeBlockHeader, DiffCodeBlock } from "./code-block"

export type MarkdownProps = {
  children: string
  className?: string
  components?: Partial<Components>
}

function extractLanguage(className?: string): string {
  if (!className) return "text"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "text"
}

const DEFAULT_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, children, node, ...props }) {
    const isInline =
      !node?.position?.start.line ||
      node?.position?.start.line === node?.position?.end.line

    if (isInline) {
      return (
        <code
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
          {...props}
        >
          {children}
        </code>
      )
    }

    const language = extractLanguage(className)
    const code = String(children).replace(/\n$/, "")

    const isDiff = language === "diff" || language === "patch"

    return (
      <CodeBlock>
        {language !== "text" && <CodeBlockHeader language={language} />}
        {isDiff
          ? <DiffCodeBlock code={code} />
          : <CodeBlockCode code={code} language={language} />
        }
      </CodeBlock>
    )
  },
  pre: ({ children }) => <>{children}</>,
  p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-5">{children}</p>,
  ul: ({ children }) => <ul className="mb-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="mb-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-5">{children}</li>,
  h1: ({ children }) => <h1 className="mb-1.5 mt-3 text-sm font-bold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1 mt-2 text-xs font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 font-semibold first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:opacity-80"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto rounded border border-border">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 px-3 py-1 last:border-0">{children}</td>
  ),
  hr: () => <hr className="my-2 border-border" />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
}

const MemoizedBlock = memo(
  function Block({ content, components }: { content: string; components: Partial<Components> }) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content}
      </ReactMarkdown>
    )
  },
  (prev, next) => prev.content === next.content
)
MemoizedBlock.displayName = "MemoizedBlock"

function MarkdownComponent({ children, className, components = DEFAULT_COMPONENTS }: MarkdownProps) {
  const blocks = useMemo(() => {
    const lines = children.split("\n")
    const result: string[] = []
    let current: string[] = []
    let inFence = false

    for (const line of lines) {
      if (line.startsWith("```")) inFence = !inFence
      current.push(line)
      if (!inFence && line === "" && current.join("\n").trim()) {
        result.push(current.join("\n").trim())
        current = []
      }
    }
    if (current.join("\n").trim()) result.push(current.join("\n").trim())
    return result.length ? result : [children]
  }, [children])

  return (
    <div className={cn("text-xs", className)}>
      {blocks.map((block, i) => (
        <MemoizedBlock key={i} content={block} components={components} />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
