import { cn } from "@/lib/utils"
import { memo, useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode, CodeBlockHeader } from "./code-block"

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
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
          {...props}
        >
          {children}
        </code>
      )
    }

    const language = extractLanguage(className)
    const code = String(children).replace(/\n$/, "")

    return (
      <CodeBlock>
        {language !== "text" && <CodeBlockHeader language={language} />}
        <CodeBlockCode code={code} language={language} />
      </CodeBlock>
    )
  },
  pre: ({ children }) => <>{children}</>,
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  h1: ({ children }) => <h1 className="mb-3 mt-4 text-xl font-bold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-3 font-semibold first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border pl-4 text-muted-foreground">
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
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-4 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/50 px-4 py-2 last:border-0">{children}</td>
  ),
  hr: () => <hr className="my-4 border-border" />,
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
    <div className={cn("text-sm", className)}>
      {blocks.map((block, i) => (
        <MemoizedBlock key={i} content={block} components={components} />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
