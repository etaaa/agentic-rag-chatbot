import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";

export function Markdown({
  content,
  onSourceClick,
}: {
  content: string;
  onSourceClick?: (page: number) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith("#source-")) {
            const page = parseInt(href.replace("#source-", ""));
            return (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (onSourceClick) onSourceClick(page);
                }}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline hover:text-primary/80 bg-primary/10 px-1 py-0.5 rounded cursor-pointer mx-0.5 align-baseline"
                title="View Source"
              >
                <FileText className="h-3 w-3" />
                {children}
              </button>
            );
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              {children}
            </a>
          );
        },
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        h1: ({ children }) => (
          <h1 className="mb-2 text-lg font-bold">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 text-base font-bold">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 text-sm font-bold">{children}</h3>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre className="mb-2 overflow-x-auto rounded-md bg-background/50 p-3 text-xs last:mb-0">
                <code>{children}</code>
              </pre>
            );
          }
          return (
            <code className="rounded bg-background/50 px-1 py-0.5 text-xs">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto last:mb-0">
            <table className="w-full text-xs border-collapse">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-background/50">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-border/50 px-2 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border/50 px-2 py-1">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-primary/30 pl-3 italic text-muted-foreground last:mb-0">
            {children}
          </blockquote>
        ),
      }}
    >
      {/* Pre-process content to make citations clickable links */}
      {content.replace(/\(Page (\d+)\)/g, "[[Page $1]](#source-$1)")}
    </ReactMarkdown>
  );
}
