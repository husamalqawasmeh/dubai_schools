import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Accept or ignore one Dubai Pulse finding.
 *
 * Accepting records a decision; it does not write the value into `schools`.
 * That is deliberate for now — the point of this queue is to answer "what does
 * Pulse have that we do not", and applying a value is a separate action with
 * its own consequences (it would be overwritten by the next KHDA ingest unless
 * it goes through school_overrides). Accepted rows are the shortlist for that.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = (locals as any).admin;
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const id = Number(form.get("id") ?? 0);
  const action = String(form.get("action") ?? "");
  const to = String(form.get("back") ?? "/admin/pulse");

  if (id && (action === "accept" || action === "ignore")) {
    await DB.prepare(
      `UPDATE pulse_findings
          SET status = ?, decided_by = ?, decided_at = ?
        WHERE id = ? AND status = 'pending'`
    )
      .bind(action === "accept" ? "accepted" : "ignored", admin.email ?? "unknown",
            new Date().toISOString(), id)
      .run();
  }
  return new Response(null, { status: 303, headers: { Location: to } });
};
