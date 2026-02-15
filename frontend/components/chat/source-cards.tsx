import { useState, useEffect } from "react";
import { FileText, Table, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Source } from "@/lib/api";
import { Markdown } from "./markdown";

function SourceModal({
  source,
  onClose,
}: {
  source: Source;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  if (!source) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-2xl flex flex-col rounded-xl border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Source Reference</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="font-medium">Page {source.page}</span>
              <span>•</span>
              <span className="uppercase">{source.content_type}</span>
            </div>
          </div>
          <button
            className="rounded-full p-1 opacity-70 hover:bg-muted hover:opacity-100 transition-all"
            onClick={onClose}
          >
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

export function SourceCards({
  sources,
  selectedSource,
  onSelectSource,
}: {
  sources: Source[];
  selectedSource: Source | null;
  onSelectSource: (source: Source | null) => void;
}) {
  if (sources.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {sources.map((source, i) => (
          <button
            key={i}
            onClick={() => onSelectSource(source)}
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
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 min-w-0"
                >
                  {source.content_type}
                </Badge>
              </div>
              {source.match_type && (
                <span
                  className={`text-[9px] px-1 py-0 rounded-sm font-medium ${
                    source.match_type === "Exact Match"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}
                >
                  {source.match_type}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      {selectedSource && (
        <SourceModal
          source={selectedSource}
          onClose={() => onSelectSource(null)}
        />
      )}
    </>
  );
}
