import type { Source } from "@/lib/api";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  steps?: string[];
  rewrittenQuery?: string;
}

export const SUGGESTED_QUESTIONS = [
  "What syringes are available?",
  "Show infusion products",
  "What needle sizes do you offer?",
  "Tell me about safety products",
];
