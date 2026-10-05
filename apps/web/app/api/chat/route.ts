import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { ChatMessage } from "@/lib/chat";
import { COMPANION_MODEL, draftReply } from "@/lib/companion";

/** How much history the companion sees. FirstRead keeps its own window for its checks. */
const MAX_MESSAGES = 30;

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json();
  // The client sends the whole history; only user and assistant turns reach the model.
  const history = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-MAX_MESSAGES);

  const stream = createUIMessageStream<ChatMessage>({
    async execute({ writer }) {
      // HY-19: start FirstRead's user check here, so it runs while the companion drafts.
      const started = performance.now();
      const draft = await draftReply(await convertToModelMessages(history), req.signal);
      writer.write({
        type: "data-timing",
        data: { model: COMPANION_MODEL, draftMs: Math.round(performance.now() - started) },
      });

      // HY-19: the reply check decides send / replace / escalate before any text is written.
      // The reply goes out in one piece, never streamed: nothing reaches the user unchecked.
      const id = crypto.randomUUID();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: draft });
      writer.write({ type: "text-end", id });
    },
    onError(error) {
      console.error("chat route:", error);
      return "The companion couldn't reply. Please try again.";
    },
  });
  return createUIMessageStreamResponse({ stream });
}
