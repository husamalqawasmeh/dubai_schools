import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { DATASETS, configured, token, fetchDataset } from "../../../lib/pulse";
import { diffRow, pickName, matchKey } from "../../../lib/pulse-diff";

/**
 * Read the open KHDA datasets on Dubai Pulse and queue whatever we do not hold.
 *
 * Writes nothing to `schools`. Every difference becomes a pending row in
 * `pulse_findings` for an admin to accept or ignore — see the migration for why
 * that gate exists rather than a direct write.
 *
 * Under /api/pulse rather than /api/admin so it can also be run on a schedule
 * later; until then the admin screen posts to it and the middleware's session
 * check is what guards it.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

const back = () => new Response(null, { status: 303, headers: { Location: "/admin/pulse" } });

export const POST: APIRoute = async ({ locals }) => {
  const admin = (locals as any).admin;
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const started = new Date().toISOString();
  const run = await DB.prepare(
    "INSERT INTO pulse_runs (started_at) VALUES (?) RETURNING id"
  ).bind(started).first<{ id: number }>();
  const runId = run!.id;

  const finish = async (ok: boolean, msg: string, ds = 0, rows = 0, found = 0) => {
    await DB.prepare(
      `UPDATE pulse_runs SET finished_at = ?, ok = ?, datasets = ?, rows_read = ?,
              found_new = ?, message = ? WHERE id = ?`
    ).bind(new Date().toISOString(), ok ? 1 : 0, ds, rows, found, msg, runId).run();
    return back();
  };

  if (!configured()) {
    return finish(
      false,
      "Dubai Pulse needs an API key and secret. The portal moved to data.dubai " +
        "and the data API answers 401 to an unregistered caller, so there is no " +
        "anonymous read to fall back on. Register an application, then set " +
        "PULSE_API_KEY and PULSE_API_SECRET as Worker secrets."
    );
  }

  // Our side, once. Names that normalise to the same key are dropped from the
  // index rather than matched arbitrarily — a wrong match writes a finding
  // against the wrong school, which is worse than reporting an unmatched one.
  const { results: mine } = await DB.prepare(
    `SELECT id, name, area, curricula, khda_rating, students_total, website, phone,
            address, lat, lng, principal, grade_range, khda_email
       FROM schools WHERE delisted_at IS NULL`
  ).all<any>();

  const index = new Map<string, any>();
  const collided = new Set<string>();
  for (const s of mine ?? []) {
    const k = matchKey(s.name);
    if (index.has(k)) collided.add(k);
    index.set(k, s);
  }
  for (const k of collided) index.delete(k);

  let datasets = 0, rowsRead = 0, found = 0;
  const now = new Date().toISOString();

  try {
    const bearer = await token();

    for (const ds of DATASETS) {
      const rows = await fetchDataset(bearer, ds.entity, ds.name);
      datasets++;
      rowsRead += rows.length;

      for (const row of rows) {
        const name = pickName(row);
        if (!name) continue;
        const ours = index.get(matchKey(name)) ?? null;

        for (const f of diffRow(row, ours)) {
          // A finding that reappears is the same finding: touch last_seen_at
          // and leave the status alone, so something ignored stays ignored.
          const res = await DB.prepare(
            `INSERT INTO pulse_findings
               (dataset, pulse_ref, school_id, school_name, kind, field,
                pulse_value, our_value, first_seen_at, last_seen_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT (dataset, COALESCE(school_id, -1), COALESCE(school_name, ''),
                          field, COALESCE(pulse_value, ''))
             DO UPDATE SET last_seen_at = excluded.last_seen_at`
          )
            .bind(
              ds.name, null, ours?.id ?? null, name, f.kind, f.field,
              f.pulse_value, f.our_value, now, now
            )
            .run();
          if ((res.meta as any)?.changes) found++;
        }
      }
    }
  } catch (e: any) {
    return finish(false, String(e?.message ?? e).slice(0, 500), datasets, rowsRead, found);
  }

  return finish(true, `Read ${datasets} dataset(s).`, datasets, rowsRead, found);
};
