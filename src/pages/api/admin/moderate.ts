import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Approve or reject one submission.
 *
 * Under /api/admin, so the middleware has already required a session.
 *
 * Nothing is deleted. A rejected submission keeps its row and gains a status,
 * a moderator and a timestamp — the record of who decided what is the point of
 * a moderation queue, and a deleted row cannot be appealed, audited, or
 * undone when someone rejects the wrong one.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

const back = () =>
  new Response(null, { status: 303, headers: { Location: "/admin/moderation" } });

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = (locals as any).admin;
  const form = await request.formData();
  const id = Number(form.get("id") ?? 0);
  const action = String(form.get("action") ?? "");

  if (!id || (action !== "approve" && action !== "reject")) return back();

  // Only a pending row can be decided. Without this, a reload of the redirect
  // would re-stamp a decision someone else had already changed.
  await DB.prepare(
    `UPDATE submissions
        SET status = ?, moderated_by = ?, moderated_at = ?
      WHERE id = ? AND status = 'pending'`
  )
    .bind(
      action === "approve" ? "approved" : "rejected",
      admin?.email ?? "unknown",
      new Date().toISOString(),
      id
    )
    .run();

  return back();
};
