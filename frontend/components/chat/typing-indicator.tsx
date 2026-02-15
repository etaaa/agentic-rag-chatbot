import { Check, Loader2 } from "lucide-react";

export function TypingIndicator({ statusSteps }: { statusSteps: string[] }) {
  return (
    <div className="flex gap-3 max-w-3xl">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden">
        <img
          src="/sanovio-logo-round.png"
          alt="SANOVIO"
          className="h-full w-full object-cover"
        />
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
