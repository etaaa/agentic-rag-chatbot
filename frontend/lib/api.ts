const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Source {
  page: number;
  content_preview: string;
  content_type: "text" | "table";
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  conversation_id: string;
}

export type SSEStatusEvent = { type: "status"; message: string };
export type SSEAnswerEvent = { type: "answer" } & ChatResponse;
export type SSEEvent = SSEStatusEvent | SSEAnswerEvent;

export async function streamMessage(
  message: string,
  conversationId: string | undefined,
  onStatus: (message: string) => void,
  onAnswer: (response: ChatResponse) => void,
  onError: (error: Error) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId ?? null,
    }),
  });

  if (!res.ok) {
    onError(new Error(`Chat request failed: ${res.statusText}`));
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    // Keep the last (potentially incomplete) line in the buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const event: SSEEvent = JSON.parse(trimmed.slice(6));
        if (event.type === "status") {
          onStatus(event.message);
        } else if (event.type === "answer") {
          onAnswer({
            answer: event.answer,
            sources: event.sources,
            conversation_id: event.conversation_id,
          });
        }
      } catch {
        // skip malformed lines
      }
    }
  }
}
