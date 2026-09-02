import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { schoolContext, SYSTEM_PROMPT, TOOLS, runTool } from "../../lib/assistant";

/**
 * The site assistant.
 *
 * Calls Anthropic directly with fetch: this runs on Workers, and an SDK for a
 * single streaming POST is not worth its weight.
 *
 * The system prompt is static — instructions plus the whole school table — so
 * it is marked cacheable, and every per-request value sits after that
 * breakpoint because prompt caching is a prefix match.
 *
 * Tool calls are resolved inside one response: the model asks for a school's
 * fee sheet, we run the SQL, hand it back, and carry on streaming into the
 * same output. The client only ever reads text and never learns a tool ran.
 */
const MODEL = "claude-opus-5";
const MAX_TOKENS = 4000;
const MAX_INPUT = 1200;
const MAX_TURNS = 8;
/** Anthropic round-trips per question, so a tool loop cannot run away. */
const MAX_HOPS = 4;
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

const safeJson = (s: string): any => {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
};

/**
 * Anthropic rejects a share of Worker-originated calls with 403 "Request not
 * allowed", non-deterministically — it appears to depend on which Cloudflare
 * egress the subrequest leaves from. Only that status is worth repeating;
 * retrying a bad key or a billing failure just wastes the visitor's time.
 */
async function callAnthropic(key: string, payload: unknown): Promise<Response> {
  let last!: Response;
  for (let attempt = 1; attempt <= 5; attempt++) {
    last = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "user-agent": "dubai-schools/1.0 (+https://dubai-schools.can-du-ai.com)",
        accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });
    if (last.ok || last.status !== 403) return last;
    await new Promise((r) => setTimeout(r, 120 * attempt));
  }
  return last;
}

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
      content: m.text!.slice(0, MAX_INPUT) as any,
    }));
  while (history.length && history[0].role !== "user") history.shift();

  const system = `${SYSTEM_PROMPT}\n\n${await schoolContext()}`;
  const messages: any[] = [...history, { role: "user", content: message }];

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = false;
      try {
        for (let hop = 0; hop < MAX_HOPS; hop++) {
          const res = await callAnthropic(key, {
            model: MODEL,
            max_tokens: MAX_TOKENS,
            stream: true,
            system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
            tools: TOOLS,
            messages,
          });

          if (!res.ok || !res.body) {
            const detail = await res.text().catch(() => "");
            console.error("[api/chat]", res.status, detail.slice(0, 300));
            if (!sent) {
              controller.enqueue(
                encoder.encode(
                  res.status === 401
                    ? "The assistant's API key is not valid."
                    : res.status === 429
                      ? "The assistant is busy. Try again in a moment."
                      : "The assistant could not be reached just now. Please ask again."
                )
              );
              sent = true;
            }
            break;
          }

          // Rebuild this turn's blocks as they arrive, so a tool call can be
          // replayed back to the model on the next hop.
          const blocks: any[] = [];
          let stopReason = "";
          let buf = "";
          const reader = res.body.getReader();

          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              let ev: any;
              try {
                ev = JSON.parse(line.slice(5).trim());
              } catch {
                continue; // keep-alives and partial frames are not errors
              }

              if (ev.type === "content_block_start") {
                blocks[ev.index] =
                  ev.content_block.type === "tool_use"
                    ? { ...ev.content_block, _json: "" }
                    : { ...ev.content_block, text: "" };
              } else if (ev.type === "content_block_delta") {
                const b = blocks[ev.index];
                if (!b) continue;
                if (ev.delta.type === "text_delta") {
                  b.text = (b.text ?? "") + ev.delta.text;
                  controller.enqueue(encoder.encode(ev.delta.text));
                  sent = true;
                } else if (ev.delta.type === "input_json_delta") {
                  b._json += ev.delta.partial_json;
                }
                // thinking_delta is the model's reasoning, not its answer.
              } else if (ev.type === "message_delta" && ev.delta?.stop_reason) {
                stopReason = ev.delta.stop_reason;
              }
            }
          }

          const toolUses = blocks.filter((b) => b && b.type === "tool_use");
          if (stopReason !== "tool_use" || !toolUses.length) break;

          messages.push({
            role: "assistant",
            content: blocks
              .filter(Boolean)
              .map((b) =>
                b.type === "tool_use"
                  ? { type: "tool_use", id: b.id, name: b.name, input: safeJson(b._json) }
                  : { type: "text", text: b.text ?? "" }
              )
              .filter((b: any) => b.type !== "text" || b.text),
          });

          const results = [];
          for (const t of toolUses) {
            let out: string;
            try {
              out = await runTool(t.name, safeJson(t._json));
            } catch (err) {
              console.error("[api/chat] tool", t.name, err);
              out = "That lookup failed. Answer from the directory table instead.";
            }
            results.push({ type: "tool_result", tool_use_id: t.id, content: out });
          }
          messages.push({ role: "user", content: results });
        }

        if (!sent) {
          controller.enqueue(
            encoder.encode("Sorry — I could not produce an answer for that. Try rephrasing it.")
          );
        }
      } catch (err) {
        console.error("[api/chat] stream", err);
        if (!sent) controller.enqueue(encoder.encode("Something went wrong. Please ask again."));
      } finally {
        controller.close();
      }
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
