import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function StepsDetail({ steps }: { steps: string[] }) {
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
