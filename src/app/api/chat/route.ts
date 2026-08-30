import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { SCHOOL_CONTEXT } from "@/lib/schoolContext";

/**
 * Chat endpoint for the site assistant.
 *
 * Calls Claude directly and streams the reply back as plain text. This replaced
 * a proxy to an n8n webhook: that webhook pointed at localhost, which a
 * serverless function cannot reach, so the chat could never have worked in
 * production.
 *
 * The system prompt is static (site instructions + the full school table), so
 * it is marked cacheable — prompt caching is a prefix match, and keeping every
 * per-request value after that breakpoint is what makes the cache hit.
 */

export const maxDuration = 60;

const MAX_INPUT_CHARS = 2_000;
/** Turns of prior conversation to keep. Each turn is one user + one assistant
 *  message, so this bounds what a client can push into a request. */
const MAX_HISTORY_TURNS = 10;

// Thinking tokens count toward max_tokens, so leave headroom above the short
// answers the system prompt asks for or a reply can be truncated mid-sentence.
const MAX_TOKENS = 8_000;

interface ChatRequest {
  chatInput?: string;
  history?: { role?: string; text?: string }[];
}

/**
 * Turns an SDK error into something a parent reading a chat panel can act on.
 * Shared by both call sites: `messages.stream()` does not throw synchronously,
 * so auth and rate-limit failures surface while the stream is being consumed,
 * not from the call that created it.
 */
function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The assistant's API key is invalid or expired.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "The assistant is busy right now. Please try again in a moment.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Sorry, the assistant is temporarily unavailable (${err.status}). Please try again shortly.`;
  }
  return "Sorry, I couldn't reach the assistant right now. Please try again in a moment.";
}

function textResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return textResponse(
      "The assistant isn't configured yet — ANTHROPIC_API_KEY is not set."
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return textResponse("Invalid request body.", 400);
  }

  const chatInput = body.chatInput?.trim();
  if (!chatInput) return textResponse("chatInput is required.", 400);
  if (chatInput.length > MAX_INPUT_CHARS) {
    return textResponse(
      `That message is too long — please keep it under ${MAX_INPUT_CHARS} characters.`
    );
  }

  // Trust only the shape, not the contents: the client supplies history, so
  // coerce roles and drop anything malformed rather than forwarding it.
  const history: Anthropic.MessageParam[] = (body.history ?? [])
    .filter((m) => typeof m?.text === "string" && m.text.trim().length > 0)
    .slice(-MAX_HISTORY_TURNS * 2)
    .map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text!.slice(0, MAX_INPUT_CHARS),
    }));

  // The API requires the first message to be from the user.
  while (history.length > 0 && history[0].role !== "user") history.shift();

  const client = new Anthropic();

  try {
    const stream = client.messages.stream({
      model: "claude-opus-5",
      max_tokens: MAX_TOKENS,
      // Medium keeps the widget responsive; this is grounded lookup and
      // explanation, not deep reasoning. Raise it if answers get sloppy.
      output_config: { effort: "medium" },
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: `${SYSTEM_PROMPT}\n\n${SCHOOL_CONTEXT}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [...history, { role: "user", content: chatInput }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let emitted = false;
        // Only separate a notice from earlier output if there was any, so a
        // failure before the first token does not start with blank lines.
        const say = (text: string) => {
          controller.enqueue(encoder.encode(emitted ? `\n\n${text}` : text));
          emitted = true;
        };
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
              emitted = true;
            }
          }
          const final = await stream.finalMessage();
          if (final.stop_reason === "refusal") {
            say(
              "Sorry — I can't help with that one. Try asking about schools, curricula, or fees in Dubai."
            );
          } else if (final.stop_reason === "max_tokens") {
            say("(That answer ran long and was cut off.)");
          }
        } catch (err) {
          say(describeError(err));
        } finally {
          controller.close();
        }
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        // Stop proxies buffering the stream into one chunk.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return textResponse(describeError(err));
  }
}
