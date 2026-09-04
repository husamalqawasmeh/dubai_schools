import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { sign } from "../../../lib/newsscan";

/**
 * The approve and discard links from the morning email.
 *
 * Clicked from an inbox, so there is no session to check — the signature in the
 * link is the authority, and it is minted per item and per action. A signature
 * for "approve item 41" cannot publish item 42 or discard anything.
 *
 * GET rather than POST because an email client can only offer a link. That
 * makes it prefetchable in principle, which is why the action is idempotent:
 * approving twice publishes once, and the page says what state the item is in
 * rather than what it just did.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

const page = (title: string, detail: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#e9f3ea;
       font:500 15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#12241a}
  .c{max-width:34rem;padding:28px 30px;background:#dceade;border:1px solid #c3d9c8;border-radius:10px}
  h1{margin:0 0 8px;font-size:19px}
  p{margin:0 0 14px;color:#3a4f41}
  a{color:#0c6455}
</style>
<div class="c"><h1>${title}</h1><p>${detail}</p>
<p><a href="https://dubai-schools.can-du-ai.com/news">Schools news</a></p></div>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

export const GET: APIRoute = async ({ url }) => {
  const id = Number(url.searchParams.get("id") ?? 0);
  const action = url.searchParams.get("do") ?? "";
  const given = url.searchParams.get("t") ?? "";

  if (!id || (action !== "approve" && action !== "reject")) {
    return page("That link is incomplete", "It is missing the item or the action.", 400);
  }

  const expected = await sign(id, action);
  if (!expected) {
    return page(
      "Approval is not configured",
      "NEWS_SCAN_TOKEN is not set on the Worker, so no link can be verified.",
      503
    );
  }
  if (given !== expected) {
    return page(
      "That link is not valid",
      "The signature does not match. Links are minted for one item and one action, so a copied or edited link will not work.",
      403
    );
  }

  const row = await DB.prepare(
    "SELECT headline, published_at, rejected_at FROM school_news WHERE id = ?"
  )
    .bind(id)
    .first<{ headline: string; published_at: string | null; rejected_at: string | null }>();

  if (!row) return page("That item is gone", "It is no longer in the database.", 404);

  if (row.published_at) {
    return page("Already published", `“${row.headline}” is live on the news page.`);
  }
  if (row.rejected_at) {
    return page("Already discarded", `“${row.headline}” was discarded and will not be offered again.`);
  }

  const now = new Date().toISOString();
  if (action === "approve") {
    await DB.prepare("UPDATE school_news SET published_at = ? WHERE id = ?").bind(now, id).run();
    return page("Published", `“${row.headline}” is now on the news page.`);
  }

  await DB.prepare("UPDATE school_news SET rejected_at = ? WHERE id = ?").bind(now, id).run();
  return page(
    "Discarded",
    `“${row.headline}” will not be published, and the scan will not offer it again.`
  );
};
