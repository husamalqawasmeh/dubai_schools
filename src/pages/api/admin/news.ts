import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Publish, discard or take down a news draft, from the console.
 *
 * The emailed links in the morning digest do the same job and still work. This
 * exists because that digest needs RESEND_API_KEY, which is not set — so every
 * scan since the first had written drafts that no one could reach. A review
 * step whose only path runs through an unconfigured mail provider is a review
 * step that silently stops the feature.
 *
 * Under /api/admin, so the middleware has already required a session.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

const back = () => new Response(null, { status: 303, headers: { Location: "/admin/news" } });

export const POST: APIRoute = async ({ request, locals }) => {
  if (!(locals as any).admin) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const id = Number(form.get("id") ?? 0);
  const action = String(form.get("action") ?? "");
  if (!id) return back();

  const now = new Date().toISOString();

  if (action === "publish") {
    // Clearing rejected_at as well: publishing something previously discarded
    // is a reversal, and leaving both stamps set would make the row disagree
    // with itself.
    await DB.prepare(
      "UPDATE school_news SET published_at = ?, rejected_at = NULL WHERE id = ?"
    )
      .bind(now, id)
      .run();
    return back();
  }

  if (action === "discard") {
    // Kept, not deleted. The scan checks what it has already offered, so a
    // deleted row would come back tomorrow as a fresh candidate.
    await DB.prepare(
      "UPDATE school_news SET rejected_at = ?, published_at = NULL WHERE id = ?"
    )
      .bind(now, id)
      .run();
    return back();
  }

  if (action === "unpublish") {
    await DB.prepare("UPDATE school_news SET published_at = NULL WHERE id = ?")
      .bind(id)
      .run();
  }

  return back();
};
