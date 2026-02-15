"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User, Sparkles } from "lucide-react";
import { streamMessage } from "@/lib/api";
import type { Source } from "@/lib/api";
import type { Message } from "./types";
import { SUGGESTED_QUESTIONS } from "./types";
import { Markdown } from "./markdown";
import { SourceCards } from "./source-cards";
import { StepsDetail } from "./steps-detail";
import { TypingIndicator } from "./typing-indicator";

function AssistantMessage({ message }: { message: Message }) {
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden bg-transparent">
        <img
          src="/sanovio-logo-round.png"
          alt="SANOVIO"
          className="h-full w-full object-cover"
        />
      </div>

      {/* Bubble */}
      <div className="min-w-0 max-w-[85%]">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm leading-relaxed">
          {message.rewrittenQuery && (
            <div className="mb-2 text-xs text-muted-foreground flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-md border border-border/50">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>
                Interpreted as:{" "}
                <span className="italic">
                  &quot;{message.rewrittenQuery}&quot;
                </span>
              </span>
            </div>
          )}
          <Markdown
            content={message.content}
            onSourceClick={(page) => {
              const source = message.sources?.find((s) => s.page === page);
              if (source) setSelectedSource(source);
            }}
          />
        </div>
        {message.steps && message.steps.length > 0 && (
          <StepsDetail steps={message.steps} />
        )}
        {message.sources && message.sources.length > 0 && (
          <SourceCards
            sources={message.sources}
            selectedSource={selectedSource}
            onSelectSource={setSelectedSource}
          />
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const statusStepsRef = useRef<string[]>([]);

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
              steps:
                statusStepsRef.current.length > 0
                  ? statusStepsRef.current
                  : undefined,
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
        }
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
        <div className="flex h-5 items-center justify-center">
          <img
            src="/sanovio-logo.svg"
            alt="SANOVIO Logo"
            className="h-full w-auto"
          />
        </div>
        <div>
          <h1 className="text-sm font-semibold">SANOVIO Assistant</h1>
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl overflow-hidden mb-6">
                <img
                  src="/sanovio-logo-round.png"
                  alt="SANOVIO Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Welcome to SANOVIO Assistant
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mb-8">
                Ask me anything about the B. Braun medical product catalog. I
                can help you find products, compare specifications, and answer
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
              {messages.map((msg, i) =>
                msg.role === "assistant" ? (
                  <AssistantMessage key={i} message={msg} />
                ) : (
                  <div key={i} className="flex gap-3 flex-row-reverse">
                    {/* Avatar */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden bg-foreground/10">
                      <User className="h-4.5 w-4.5 text-foreground/70" />
                    </div>

                    {/* Bubble */}
                    <div className="min-w-0 max-w-[85%] flex flex-col items-end">
                      <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                )
              )}
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
            SANOVIO may produce inaccurate information. Verify important details.
          </p>
        </div>
      </div>
    </div>
  );
}
