import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { STATUSES, categoryLabel } from "../../../lib/providers";
import { sendTo } from "../../../lib/notify";

/**
 * Everything an admin can do to a registered supplier: approve, reject, freeze,
 * ask a question, annotate, delete.
 *
 * Under /api/admin, so the middleware has already required a session.
 *
 * Rejecting and freezing both take a listing off the page and are deliberately
 * separate: rejected means it should not have been sent, frozen means it was
 * fine and is off for now. Whether it is coming back is the one thing worth
 * recording about a listing that is down.
 *
 * Deleting is neither. It removes the row, and it is for what should never have
 * existed — keeping spam on the off-chance is how a queue fills with things
 * nobody will look at again.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

const back = (q = "") =>
  new Response(null, { status: 303, headers: { Location: `/admin/providers${q}` } });

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = (locals as any).admin;
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const id = Number(form.get("id") ?? 0);
  const action = String(form.get("action") ?? "");
  if (!id) return back();

  const now = new Date().toISOString();
  const who = admin.email ?? "unknown";

  if (action === "delete") {
    await DB.prepare("DELETE FROM providers WHERE id = ?").bind(id).run();
    return back();
  }

  if (action === "note") {
    await DB.prepare("UPDATE providers SET note = ?, updated_at = ? WHERE id = ?")
      .bind(String(form.get("note") ?? "").trim().slice(0, 400) || null, now, id)
      .run();
    return back();
  }

  /**
   * Ask the supplier something.
   *
   * The question is written down first and sent second, and the status does not
   * move — a supplier being asked to clarify is still waiting, and marking them
   * anything else would take them out of the queue while the answer is what the
   * queue is waiting for.
   *
   * If mail is not configured the record still stands and the screen offers the
   * message as a mailto link. That is the honest failure: the admin can see the
   * question was not sent and can send it by hand, rather than being told it
   * went and finding out later that it did not.
   */
  if (action === "query") {
    const text = String(form.get("query") ?? "").trim().slice(0, 1200);
    if (!text) return back();

    const row = await DB.prepare(
      "SELECT name, email, category FROM providers WHERE id = ?"
    )
      .bind(id)
      .first<{ name: string; email: string | null; category: string }>();
    if (!row) return back();

    await DB.prepare(
      `UPDATE providers
          SET last_query = ?, last_query_at = ?, last_query_by = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(text, now, who, now, id)
      .run();

    if (!row.email) return back("?mail=noaddress#p" + id);

    const sent = await sendTo(
      row.email,
      `About your listing on Dubai Schools — ${row.name}`,
      [
        `Hello,`,
        ``,
        `You registered ${row.name} on dubai-schools.can-du-ai.com under`,
        `${categoryLabel(row.category)}. Before it goes live we would like to ask:`,
        ``,
        text,
        ``,
        `Just reply to this email and we will pick it up from there.`,
        ``,
        `Dubai Schools`,
        `https://dubai-schools.can-du-ai.com/suppliers`,
      ]
    );

    return back(sent.ok ? "?mail=sent#p" + id : "?mail=failed#p" + id);
  }

  if (STATUSES.includes(action as any)) {
    await DB.prepare(
      `UPDATE providers
          SET status = ?, decided_by = ?, decided_at = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(action, who, now, now, id)
      .run();
  }

  return back();
};
