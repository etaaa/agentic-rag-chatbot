"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  User,
  FileText,
  Table,
  Sparkles,
  Check,
  Loader2,
  ChevronDown,
  X,
} from "lucide-react";
import { streamMessage, type Source } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  steps?: string[];
  rewrittenQuery?: string;
}

const SUGGESTED_QUESTIONS = [
  "What syringes are available?",
  "Show infusion products",
  "What needle sizes do you offer?",
  "Tell me about safety products",
];



function SourceModal({ source, onClose }: { source: Source; onClose: () => void }) {
  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  if (!source) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
      <div className="relative max-h-[85vh] w-full max-w-2xl flex flex-col rounded-xl border bg-background shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Source Reference</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="font-medium">Page {source.page}</span>
              <span>•</span>
              <span className="uppercase">{source.content_type}</span>
            </div>
          </div>
          <button className="rounded-full p-1 opacity-70 hover:bg-muted hover:opacity-100 transition-all" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown content={source.source_text} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceCards({ sources }: { sources: Source[] }) {
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  // Listen for custom event to open modal from markdown links
  useEffect(() => {
    const handleOpenSource = (e: CustomEvent<Source>) => {
      setSelectedSource(e.detail);
    };
    document.addEventListener('open-source-modal', handleOpenSource as EventListener);
    return () => {
      document.removeEventListener('open-source-modal', handleOpenSource as EventListener);
    };
  }, []);

  if (sources.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <button
            key={i}
            onClick={() => setSelectedSource(source)}
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs transition-colors hover:bg-muted/50 hover:border-primary/30 text-left group"
          >
            {source.content_type === "table" ? (
              <Table className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
            <div className="flex flex-col items-start gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-medium">Page {source.page}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-0">
                  {source.content_type}
                </Badge>
              </div>
              {source.match_type && (
                <span className={`text-[9px] px-1 py-0 rounded-sm font-medium ${source.match_type === "Exact Match"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                  {source.match_type}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      {selectedSource && (
        <SourceModal source={selectedSource} onClose={() => setSelectedSource(null)} />
      )}
    </>
  );
}

function StepsDetail({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span>{steps.length} steps performed</span>
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1 pl-1">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Check className="h-3 w-3 shrink-0 text-emerald-500" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Markdown({ content, onSourceClick }: { content: string, onSourceClick?: (page: number) => void }) {
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
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{children}</a>;
        },
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
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
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
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
            <table className="w-full text-xs border-collapse">{children}</table>
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

function TypingIndicator({ statusSteps }: { statusSteps: string[] }) {
  return (
    <div className="flex gap-3 max-w-3xl">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="h-4.5 w-4.5 text-primary" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        {statusSteps.length === 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {statusSteps.map((step, i) => {
              const isActive = i === statusSteps.length - 1;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 animate-fade-in-up text-xs"
                >
                  {isActive ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  )}
                  <span
                    className={
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusSteps, setStatusSteps] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const statusStepsRef = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, statusSteps, scrollToBottom]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function autoResize() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);
    setStatusSteps([]);
    statusStepsRef.current = [];

    try {
      await streamMessage(
        trimmed,
        conversationId,
        (status) => {
          statusStepsRef.current = [...statusStepsRef.current, status];
          setStatusSteps(statusStepsRef.current);
        },
        (res) => {
          setConversationId(res.conversation_id);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.answer,
              sources: res.sources,
              steps: statusStepsRef.current.length > 0 ? statusStepsRef.current : undefined,
              rewrittenQuery: res.rewritten_query,
            },
          ]);
        },
        (error) => {
          console.error(error);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Sorry, something went wrong. Please try again.",
            },
          ]);
        },
      );
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setStatusSteps([]);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">Sanovio Assistant</h1>
          <p className="text-xs text-muted-foreground">
            B. Braun product catalog
          </p>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
        <div className="mx-auto max-w-3xl px-6">
          {messages.length === 0 ? (
            /* Welcome Screen */
            <div className="flex min-h-[calc(100vh-10.5rem)] flex-col items-center justify-center text-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Welcome to Sanovio Assistant
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mb-8">
                Ask me anything about the B. Braun medical product catalog.
                I can help you find products, compare specifications, and answer
                technical questions.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSend(question)}
                    className="rounded-xl border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 hover:border-primary/20"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-6">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === "assistant"
                      ? "bg-primary/10"
                      : "bg-foreground/10"
                      }`}
                  >
                    {msg.role === "assistant" ? (
                      <Bot className="h-4.5 w-4.5 text-primary" />
                    ) : (
                      <User className="h-4.5 w-4.5 text-foreground/70" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`min-w-0 max-w-[85%] ${msg.role === "user" ? "flex flex-col items-end" : ""
                      }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "assistant"
                        ? "rounded-tl-sm bg-muted"
                        : "rounded-tr-sm bg-primary text-primary-foreground"
                        }`}
                    >
                      {msg.rewrittenQuery && (
                        <div className="mb-2 text-xs text-muted-foreground flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-md border border-border/50">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>Interpreted as: <span className="italic">&quot;{msg.rewrittenQuery}&quot;</span></span>
                        </div>
                      )}

                      {msg.role === "assistant" ? (
                        <Markdown content={msg.content} onSourceClick={(page) => {
                          const source = msg.sources?.find(s => s.page === page);
                          if (source) {
                            // Trigger finding and opening this source
                            // Since we don't have easy access to set the modal from here without context,
                            // we will dispatch a custom event or use a ref. 
                            // For simplicity in this single-file component:
                            document.dispatchEvent(new CustomEvent('open-source-modal', { detail: source }));
                          }
                        }} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {msg.steps && msg.steps.length > 0 && (
                      <StepsDetail steps={msg.steps} />
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourceCards sources={msg.sources} />
                    )}
                  </div>
                </div>
              ))}
              {isLoading && <TypingIndicator statusSteps={statusSteps} />}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-background">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 rounded-2xl border bg-card px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the product catalog..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-xl"
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
            Sanovio may produce inaccurate information. Verify important details.
          </p>
        </div>
      </div>
    </div>
  );
}
