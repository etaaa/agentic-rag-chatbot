import type { Source } from "@/lib/api";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  steps?: string[];
  rewrittenQuery?: string;
}

export const SUGGESTED_QUESTIONS = [
  "What sizes are available for Medibox?",
  "Compare Sterican and Sterican Safety needles",
  "Look up product with Art.-Nr. 4617022V",
  "What are the Omnican Fine pen needle specifications?",
];
