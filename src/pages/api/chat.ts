import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { schoolContext, SYSTEM_PROMPT } from "../../lib/assistant";

/**
 * The site assistant.
 *
 * Calls Anthropic directly with fetch rather than through the SDK: this runs
 * on Workers, the request is a single streaming POST, and a dependency for
 * that is not worth its weight.
 *
 * The system prompt is static — instructions plus the whole school table — so
 * it is marked cacheable. Prompt caching is a prefix match, which is why every
 * per-request value sits after that breakpoint.
 */
const MODEL = "claude-opus-5";
const MAX_TOKENS = 4000;
const MAX_INPUT = 1200;
const MAX_TURNS = 8;
/** Messages allowed from one address per hour. This endpoint costs money. */
const RATE_LIMIT = 40;

async function hashIp(ip: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`chat:${ip}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const text = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

export const POST: APIRoute = async ({ request }) => {
  const key = (env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY;
  if (!key) return text("The assistant is not configured yet.");

  let body: { message?: string; history?: { role?: string; text?: string }[] };
  try {
    body = await request.json();
  } catch {
    return text("Could not read that.", 400);
  }

  const message = (body.message ?? "").trim().slice(0, MAX_INPUT);
  if (!message) return text("Ask a question first.", 400);

  // Cheap per-address ceiling, reusing the submissions table's own rate window.
  const DB = (env as unknown as { DB: D1Database }).DB;
  const ipHash = await hashIp(request.headers.get("CF-Connecting-IP") ?? "unknown");
  const since = new Date(Date.now() - 3600_000).toISOString();
  const used = await DB.prepare(
    "SELECT COUNT(*) n FROM audit_log WHERE action='chat' AND detail=? AND at>?"
  )
    .bind(ipHash, since)
    .first<{ n: number }>();
  if ((used?.n ?? 0) >= RATE_LIMIT) {
    return text("That is a lot of questions in one hour. Please come back later.");
  }
  await DB.prepare("INSERT INTO audit_log (at, action, detail) VALUES (?, 'chat', ?)")
    .bind(new Date().toISOString(), ipHash)
    .run();

  // Trust the shape, not the contents: the client supplies history.
  const history = (body.history ?? [])
    .filter((m) => typeof m?.text === "string" && m.text.trim())
    .slice(-MAX_TURNS * 2)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text!.slice(0, MAX_INPUT),
    }));
  while (history.length && history[0].role !== "user") history.shift();

  const system = `${SYSTEM_PROMPT}\n\n${await schoolContext()}`;

  /**
   * Anthropic rejects a share of Worker-originated calls with 403 "Request
   * not allowed" — measured at roughly 5 in 8, and it is not deterministic:
   * the same request succeeds on a retry. It appears to depend on which
   * Cloudflare egress address the subrequest leaves from.
   *
   * So retry the 403 specifically. Everything else is returned to the caller
   * on the first attempt, because retrying a bad key or a billing failure
   * only wastes the visitor's time.
   */
  const ATTEMPTS = 5;
  let upstream!: Response;
  let lastStatus = 0;
  let lastDetail = "";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "user-agent": "dubai-schools/1.0 (+https://dubai-schools.can-du-ai.com)",
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          stream: true,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [...history, { role: "user", content: message }],
        }),
      });
    } catch (err) {
      console.error("[api/chat] fetch failed", err);
      if (attempt === ATTEMPTS) return text("Could not reach the assistant. Please try again.");
      continue;
    }

    if (upstream.ok && upstream.body) break;

    lastStatus = upstream.status;
    lastDetail = await upstream.text().catch(() => "");
    if (lastStatus !== 403) break;   // only the flaky one is worth repeating

    console.warn(`[api/chat] 403 on attempt ${attempt}, retrying`);
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 120 * attempt));
  }

  if (!upstream.ok || !upstream.body) {
    console.error("[api/chat]", lastStatus, lastDetail.slice(0, 400));
    if (lastStatus === 401) return text("The assistant's API key is not valid.");
    if (lastStatus === 429) return text("The assistant is busy. Try again in a moment.");
    if (/credit balance|billing/i.test(lastDetail))
      return text("The assistant is unavailable — the account behind it needs billing attention.");
    return text("The assistant could not be reached just now. Please ask again.");
  }

  // Unwrap the SSE stream into plain text so the client is a simple reader.
  //
  // Driven from start() with its own loop rather than from pull(): the model
  // emits a thinking block before the text one, so several reads in a row
  // yield no text at all, and a pull-driven stream that enqueues nothing has
  // nothing to pull against.
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let sent = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            try {
              const ev = JSON.parse(line.slice(5).trim());
              // thinking_delta is deliberately ignored: it is the model's
              // reasoning, not its answer.
              if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
                controller.enqueue(encoder.encode(ev.delta.text));
                sent = true;
              }
            } catch {
              /* keep-alives and partial frames are not errors */
            }
          }
        }
        if (!sent) {
          controller.enqueue(
            encoder.encode("Sorry — I could not produce an answer for that. Try rephrasing it.")
          );
        }
      } catch (err) {
        console.error("[api/chat] stream", err);
        controller.enqueue(encoder.encode("\n\nThe answer was cut off. Please try again."));
      } finally {
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
};
