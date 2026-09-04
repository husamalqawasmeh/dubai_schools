import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { scanNews, sign, type Candidate } from "../../../lib/newsscan";
import { notify } from "../../../lib/notify";

/**
 * The morning scan. Triggered by a scheduled job, not by a visitor, so it is
 * gated on a shared token rather than a session — a cron runner has no cookie.
 *
 * The runner sends the headlines it fetched, because Google answers this Worker
 * with 503 and will not be talked round. Everything after that — knowing what
 * has been seen, summarising, writing drafts, sending the digest — happens
 * here, where the database and the mail key are.
 *
 * POST /api/news/scan
 *   Authorization: Bearer <NEWS_SCAN_TOKEN>
 *   Origin: https://dubai-schools.can-du-ai.com
 *
 * The Origin header is not decoration. Astro rejects any cross-site POST, and a
 * cron runner sends no Origin at all, so without it every scheduled run is
 * refused before this file is reached — with a CSRF message that looks nothing
 * like an auth problem.
 *
 * It never publishes. It writes drafts and emails a digest whose links do the
 * publishing, so approval is a deliberate act by a person.
 */
const SITE = "https://dubai-schools.can-du-ai.com";

export const POST: APIRoute = async ({ request }) => {
  const token = (env as unknown as { NEWS_SCAN_TOKEN?: string }).NEWS_SCAN_TOKEN;
  if (!token) {
    return new Response("Scanning is not configured.", { status: 503 });
  }

  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  // Length-independent compare would be better, but the token is compared
  // whole and a mismatch leaks only its length, which is not a secret.
  if (given !== token) {
    return new Response("Not allowed.", { status: 403 });
  }

  let items: Candidate[] = [];
  try {
    const body = (await request.json()) as { items?: unknown };
    if (Array.isArray(body?.items)) {
      items = body.items
        .filter((x: any) => x && typeof x.headline === "string" && typeof x.url === "string")
        .slice(0, 200)
        .map((x: any) => ({
          headline: String(x.headline).slice(0, 300),
          url: String(x.url).slice(0, 600),
          source: String(x.source ?? "").slice(0, 120),
          published: String(x.published ?? "").slice(0, 60),
        }));
    }
  } catch {
    return new Response("Send { items: [...] } as JSON.", { status: 400 });
  }

  if (!items.length) {
    return new Response(JSON.stringify({ fetched: 0, candidates: 0, inserted: 0, skipped: 0, drafts: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await scanNews(items);

  if (result.drafts.length) {
    const lines: string[] = [
      `${result.drafts.length} item${result.drafts.length === 1 ? "" : "s"} for review.`,
      `Scanned ${result.fetched} headlines, ${result.candidates} were about Dubai schooling, ${result.skipped} had been seen before.`,
      "",
    ];

    for (const d of result.drafts) {
      const ok = await sign(d.id, "approve");
      const no = await sign(d.id, "reject");
      if (!ok || !no) continue;
      lines.push(
        "─".repeat(58),
        d.headline,
        d.body || "(no summary — the headline is all we have)",
        `Source: ${d.source || "unknown"} — ${d.url}`,
        "",
        `PUBLISH:  ${SITE}/api/news/decide?id=${d.id}&do=approve&t=${ok}`,
        `DISCARD:  ${SITE}/api/news/decide?id=${d.id}&do=reject&t=${no}`,
        ""
      );
    }

    lines.push(
      "─".repeat(58),
      "Nothing above is on the site. Clicking PUBLISH puts one item live;",
      "clicking DISCARD keeps it out and stops it being offered again.",
      "Ignoring this email leaves everything unpublished."
    );

    await notify(`Schools news — ${result.drafts.length} for review`, lines);
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
