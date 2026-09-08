import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Approve, hide, show again, or delete a registered supplier.
 *
 * Under /api/admin, so the middleware has already required a session.
 *
 * Hiding and deleting are deliberately separate. Hiding takes a listing off
 * the page and keeps the row, which is what you want for a supplier who has
 * gone quiet or whose details need checking — it can be put back with one
 * click. Deleting is for what should never have been submitted, and it really
 * does remove the row, because keeping spam on the off-chance is how a queue
 * fills with things nobody will ever look at again.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

const back = () =>
  new Response(null, { status: 303, headers: { Location: "/admin/providers" } });

const STATUSES = new Set(["approved", "hidden", "pending"]);

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = (locals as any).admin;
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const id = Number(form.get("id") ?? 0);
  const action = String(form.get("action") ?? "");
  if (!id) return back();

  const now = new Date().toISOString();

  if (action === "delete") {
    await DB.prepare("DELETE FROM providers WHERE id = ?").bind(id).run();
    return back();
  }

  if (STATUSES.has(action)) {
    await DB.prepare(
      `UPDATE providers
          SET status = ?, decided_by = ?, decided_at = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(action, admin.email ?? "unknown", now, now, id)
      .run();
    return back();
  }

  if (action === "note") {
    await DB.prepare("UPDATE providers SET note = ?, updated_at = ? WHERE id = ?")
      .bind(String(form.get("note") ?? "").trim().slice(0, 400) || null, now, id)
      .run();
  }

  return back();
};
