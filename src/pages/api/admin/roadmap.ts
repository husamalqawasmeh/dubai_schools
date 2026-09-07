import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Every change to the roadmap: add, delete, tick, and move.
 *
 * Under /api/admin, so the middleware has already required a session — there is
 * no auth check here because there is nothing this file could add to it.
 *
 * Plain form posts, and every one of them redirects back to the page. That is
 * what makes the whole board work without JavaScript: a checkbox that needs a
 * script to save is a checkbox that silently does nothing when the script fails,
 * and this is the one page whose entire job is recording decisions.
 */
const DB = (env as unknown as { DB: D1Database }).DB;
const BACK = "/admin/roadmap";

const back = () => new Response(null, { status: 303, headers: { Location: BACK } });

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const id = Number(form.get("id") ?? 0);
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  /** An empty date field means "no date", not "the epoch". */
  const dateOrNull = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };

  if (action === "add") {
    const title = String(form.get("title") ?? "").trim().slice(0, 300);
    if (!title) return back();
    // New items land at the end. Appending is the safe default: an item pushed
    // to the top would reorder someone else's list without being asked to.
    const max = await DB.prepare("SELECT COALESCE(MAX(position), 0) p FROM roadmap").first<{ p: number }>();
    // Today is the entry date, because today is when it was entered. It stays
    // editable, so anything raised earlier can be backdated.
    await DB.prepare(
      `INSERT INTO roadmap (title, done, position, entry_date, created_at, updated_at)
       VALUES (?, 0, ?, ?, ?, ?)`
    )
      .bind(title, (max?.p ?? 0) + 10, today, now, now)
      .run();
    return back();
  }

  if (!id) return back();

  if (action === "delete") {
    await DB.prepare("DELETE FROM roadmap WHERE id = ?").bind(id).run();
    return back();
  }

  if (action === "edit") {
    const title = String(form.get("title") ?? "").trim().slice(0, 300);
    if (!title) return back();
    await DB.prepare(
      "UPDATE roadmap SET title = ?, entry_date = ?, completion_date = ?, updated_at = ? WHERE id = ?"
    )
      .bind(title, dateOrNull(form.get("entry_date")), dateOrNull(form.get("completion_date")), now, id)
      .run();
    return back();
  }

  if (action === "toggle") {
    // Flipped in SQL rather than read-then-written, so two tabs open on the
    // same list cannot both read "not done" and both write "done".
    //
    // Ticking fills the completion date only when it is empty, so it never
    // overwrites a date someone set deliberately. Unticking leaves it alone
    // rather than clearing it: the date is a fact about when the work
    // finished, and a mis-click should not delete a fact.
    await DB.prepare(
      `UPDATE roadmap
          SET done = 1 - done,
              completion_date = CASE
                WHEN done = 0 AND completion_date IS NULL THEN ?
                ELSE completion_date
              END,
              updated_at = ?
        WHERE id = ?`
    )
      .bind(today, now, id)
      .run();
    return back();
  }

  if (action === "up" || action === "down") {
    const row = await DB.prepare("SELECT id, position FROM roadmap WHERE id = ?")
      .bind(id)
      .first<{ id: number; position: number }>();
    if (!row) return back();

    // The neighbour is whichever row is nearest in the direction of travel —
    // found by position rather than by index, so it stays correct even if two
    // items somehow share a position.
    const neighbour = await DB.prepare(
      action === "up"
        ? "SELECT id, position FROM roadmap WHERE position < ? ORDER BY position DESC LIMIT 1"
        : "SELECT id, position FROM roadmap WHERE position > ? ORDER BY position ASC LIMIT 1"
    )
      .bind(row.position)
      .first<{ id: number; position: number }>();
    if (!neighbour) return back();   // already at the end it was asked to move to

    await DB.batch([
      DB.prepare("UPDATE roadmap SET position = ?, updated_at = ? WHERE id = ?")
        .bind(neighbour.position, now, row.id),
      DB.prepare("UPDATE roadmap SET position = ?, updated_at = ? WHERE id = ?")
        .bind(row.position, now, neighbour.id),
    ]);
    return back();
  }

  return back();
};
