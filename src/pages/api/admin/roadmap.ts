import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { todayInDubai } from "../../../lib/today";

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
/* The page moved to /admin/improvements; this endpoint did not — it is
   named for the `roadmap` table it writes, which is unchanged. */
const BACK = "/admin/improvements";

const back = () => new Response(null, { status: 303, headers: { Location: BACK } });

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const id = Number(form.get("id") ?? 0);
  const now = new Date().toISOString();
  /* The board records what happened on a given day in Dubai, so "today"
     has to be today there — `now` is UTC and would roll over four hours
     early. */
  const today = todayInDubai();

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
    // The form offers a date, defaulted to today, so something raised last
    // week can be entered with the date it was actually raised. Today stays
    // the fallback for a submission that carries no date at all.
    const entry = dateOrNull(form.get("entry_date")) ?? today;
    await DB.prepare(
      `INSERT INTO roadmap (title, done, position, entry_date, created_at, updated_at)
       VALUES (?, 0, ?, ?, ?, ?)`
    )
      .bind(title, (max?.p ?? 0) + 10, entry, now, now)
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

    /* The serial is editable, and it is a position, not a stored number —
       typing 1 into row 7 means "put this first". So it moves the row and
       renumbers the rest, which is the same thing the up and down arrows do,
       just further in one go.

       Positions are rewritten as 10, 20, 30… rather than 1, 2, 3. The arrows
       work by swapping neighbours and the gaps leave room for that to keep
       working without a rewrite each time. */
    const wanted = Number(form.get("serial") ?? 0);
    if (Number.isInteger(wanted) && wanted > 0) {
      const { results } = await DB.prepare(
        "SELECT id FROM roadmap ORDER BY position ASC, id ASC"
      ).all<{ id: number }>();
      const ids = (results ?? []).map((r) => r.id);
      const from = ids.indexOf(id);
      // Clamped, not rejected: 99 on a list of nine means "last", which is
      // what someone typing 99 into it meant.
      const to = Math.min(wanted, ids.length) - 1;
      if (from !== -1 && to !== from) {
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        const stmt = DB.prepare("UPDATE roadmap SET position = ?, updated_at = ? WHERE id = ?");
        await DB.batch(ids.map((rid, k) => stmt.bind((k + 1) * 10, now, rid)));
      }
    }
    return back();
  }

  if (action === "toggle") {
    // Flipped in SQL rather than read-then-written, so two tabs open on the
    // same list cannot both read "not done" and both write "done".
    //
    // Ticking fills the completion date only when it is empty, so it never
    // overwrites a date someone set deliberately. Unticking clears it: an
    // item that is not done has no completion date, and leaving one behind
    // meant a row could show "Completed 8 Sept" with an empty box beside it.
    // The date can be typed back in from the edit form if it was a mis-click.
    await DB.prepare(
      `UPDATE roadmap
          SET done = 1 - done,
              completion_date = CASE
                -- becoming done, with no date of its own yet
                WHEN done = 0 AND completion_date IS NULL THEN ?
                -- becoming done, keeping the date it already had
                WHEN done = 0 THEN completion_date
                -- becoming not done
                ELSE NULL
              END,
              updated_at = ?
        WHERE id = ?`
    )
      .bind(today, now, id)
      .run();
    return back();
  }

  if (action === "up" || action === "down") {
    /* Each click moves the item one place, so moving it five places is five
       clicks, and the arrows stay live until the item reaches the end it is
       being sent to.

       The swap is one statement covering both rows, and the value it writes
       is self-inverse: given the pair of positions, each row takes the sum
       minus its own. That matters more than it looks. Two UPDATEs can half-
       apply and leave two items sharing a position, and a version of this
       that found the neighbour inside the UPDATE was worse still — the
       subquery re-read the table as the same statement was changing it, so
       the second row swapped against a value the first had already moved.
       Tested against SQLite before it shipped: an item walked the length of
       the list and back returns to where it started, and no position is ever
       duplicated or left null. */
    const row = await DB.prepare("SELECT id, position FROM roadmap WHERE id = ?")
      .bind(id)
      .first<{ id: number; position: number }>();
    if (!row) return back();

    // The neighbour is whichever row is nearest in the direction of travel,
    // found by position rather than by index.
    const neighbour = await DB.prepare(
      action === "up"
        ? "SELECT id, position FROM roadmap WHERE position < ? ORDER BY position DESC LIMIT 1"
        : "SELECT id, position FROM roadmap WHERE position > ? ORDER BY position ASC LIMIT 1"
    )
      .bind(row.position)
      .first<{ id: number; position: number }>();
    if (!neighbour) return back();   // already at the end it was asked to move to

    await DB.prepare(
      "UPDATE roadmap SET position = ? - position, updated_at = ? WHERE id IN (?, ?)"
    )
      .bind(row.position + neighbour.position, now, row.id, neighbour.id)
      .run();
    return back();
  }

  return back();
};
