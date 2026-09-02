import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const DB = (env as unknown as { DB: D1Database }).DB;

const AUDIENCES = ["student", "parent", "school", "site"] as const;
const KINDS = ["comment", "info_request", "school_details"] as const;

const MAX_MESSAGE = 4000;
const MAX_SHORT = 120;
/** Submissions allowed from one address per hour. Crude, but it is the
 *  difference between a slow trickle of spam and an overnight flood. The
 *  real fix is Turnstile on the form; this is the floor beneath it. */
const RATE_LIMIT = 6;

/** The raw IP is never stored. This is only ever compared to itself. */
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`dxb-schools:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Could not read that submission." }, 400);
  }

  // Honeypot: a real person never fills a field they cannot see. Answer as if
  // it worked, so a bot gets no signal about what gave it away.
  if (clean(body.website, 200)) return json({ ok: true });

  const audience = clean(body.audience, 20);
  const kind = clean(body.kind, 20);
  if (!AUDIENCES.includes(audience as any) || !KINDS.includes(kind as any)) {
    return json({ ok: false, error: "Unknown form." }, 400);
  }

  const message = clean(body.message, MAX_MESSAGE);
  if (message.length < 10) {
    return json({ ok: false, error: "Please write a little more — at least 10 characters." }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const ipHash = await hashIp(ip);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await DB.prepare(
    "SELECT COUNT(*) n FROM submissions WHERE ip_hash = ? AND created_at > ?"
  )
    .bind(ipHash, since)
    .first<{ n: number }>();

  if ((recent?.n ?? 0) >= RATE_LIMIT) {
    return json(
      { ok: false, error: "That is a lot of submissions in one hour. Please try again later." },
      429
    );
  }

  const schoolName = clean(body.school_name, MAX_SHORT);
  let schoolId: number | null = null;
  if (schoolName) {
    const row = await DB.prepare("SELECT id FROM schools WHERE name = ? LIMIT 1")
      .bind(schoolName)
      .first<{ id: number }>();
    schoolId = row?.id ?? null;
  }

  await DB.prepare(
    `INSERT INTO submissions
       (audience, kind, school_id, school_name, author_name, contact, message,
        ip_hash, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      audience,
      kind,
      schoolId,
      schoolName || null,
      clean(body.author_name, MAX_SHORT) || null,
      clean(body.contact, MAX_SHORT) || null,
      message,
      ipHash,
      (request.headers.get("User-Agent") ?? "").slice(0, 300),
      new Date().toISOString()
    )
    .run();

  return json({ ok: true });
};
