import { NextResponse } from "next/server";

// Forwards chat messages to the n8n chat webhook (configured via
// N8N_CHAT_WEBHOOK_URL). Kept server-side so the browser never talks to
// n8n directly (avoids CORS and keeps the internal URL out of the client
// bundle).

// Give slow AI-agent workflows (multiple tool calls, etc.) as much room as
// possible to respond. If this is deployed to a serverless platform (e.g.
// Vercel), maxDuration is capped by the plan (Hobby: 60s, Pro: 300s,
// Enterprise: 900s) — raise both together and keep them in sync.
const UPSTREAM_TIMEOUT_MS = 300_000; // 5 minutes
export const maxDuration = 300; // seconds

function extractReply(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["output", "text", "reply", "message", "response"]) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
  }
  if (Array.isArray(data) && data.length > 0) {
    return extractReply(data[0]);
  }
  return null;
}

export async function POST(req: Request) {
  const webhookUrl = process.env.N8N_CHAT_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { reply: "The chatbot isn't configured yet — no webhook URL is set.", ok: false },
      { status: 200 }
    );
  }

  let body: { sessionId?: string; chatInput?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const chatInput = body.chatInput?.trim();
  if (!chatInput) {
    return NextResponse.json({ error: "chatInput is required" }, { status: 400 });
  }
  const sessionId = body.sessionId || crypto.randomUUID();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sendMessage", sessionId, chatInput }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      return NextResponse.json(
        {
          reply: `Sorry, the assistant is temporarily unavailable (status ${upstream.status}). Please try again shortly.`,
          ok: false,
          sessionId,
        },
        { status: 200 }
      );
    }

    const contentType = upstream.headers.get("content-type") || "";
    const raw = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text();

    const reply = extractReply(raw);

    return NextResponse.json({
      reply: reply ?? "Sorry, I couldn't understand that response. Please try again.",
      ok: reply !== null,
      sessionId,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        reply: timedOut
          ? "Sorry, that took too long to answer. Please try again."
          : "Sorry, I couldn't reach the assistant right now. Please try again in a moment.",
        ok: false,
        sessionId,
      },
      { status: 200 }
    );
  }
}
