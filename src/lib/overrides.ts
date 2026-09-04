import { env } from "cloudflare:workers";

const DB = (env as unknown as { DB: D1Database }).DB;

/**
 * Field-level corrections, applied on top of the scraped row at read time.
 *
 * The table has been in the schema since 0001, with a comment describing
 * exactly this, and nothing had written to it or read from it. The point of
 * correcting here rather than in `schools` is that the ingest owns that table:
 * a value typed straight into it survives only until the next scrape.
 *
 * Two kinds of key live here:
 *
 *   - names matching a column on `schools`, which replace what was scraped
 *   - names in EXTRA below, which KHDA does not publish at all and no scrape
 *     will ever fill in — a motto, a logo, the highlights a school wants said
 *
 * Both are stored the same way: JSON in `value`, so a null is a deliberate
 * blank rather than a missing row, and a reason is required either way.
 */

/** Corrections to something that was scraped. */
export const OVERRIDABLE = [
  "name",
  "area",
  "curricula",
  "khda_rating",
  "fee_min_aed",
  "fee_max_aed",
  "fee_year",
  "fee_note",
  "grade_range",
  "students_total",
  "website",
  "phone",
  "address",
  "lat",
  "lng",
  "description",
  "principal",
] as const;

/** Ours alone: nothing upstream publishes these. */
export const EXTRA = ["motto", "highlights", "logo_url"] as const;

export type OverridableField = (typeof OVERRIDABLE)[number] | (typeof EXTRA)[number];

const ALL: readonly string[] = [...OVERRIDABLE, ...EXTRA];
export const isOverridable = (f: string): f is OverridableField => ALL.includes(f);

/** Fields held as a JSON array rather than a scalar. */
const ARRAY_FIELDS = new Set(["curricula"]);
/** Fields held as a number. */
const NUMBER_FIELDS = new Set([
  "fee_min_aed",
  "fee_max_aed",
  "students_total",
  "lat",
  "lng",
]);

export interface OverrideRow {
  school_id: number;
  field: string;
  value: string | null;
  reason: string;
  set_at: string;
  set_by: number | null;
}

/** Every override, indexed by school. One query serves a whole listing: at 232
 *  schools this is smaller than the school rows it decorates. */
export async function overridesBySchool(): Promise<Map<number, OverrideRow[]>> {
  const { results } = await DB.prepare(
    "SELECT school_id, field, value, reason, set_at, set_by FROM school_overrides"
  ).all<OverrideRow>();
  const map = new Map<number, OverrideRow[]>();
  for (const row of results) {
    const list = map.get(row.school_id);
    if (list) list.push(row);
    else map.set(row.school_id, [row]);
  }
  return map;
}

export async function overridesFor(schoolId: number): Promise<OverrideRow[]> {
  const { results } = await DB.prepare(
    `SELECT school_id, field, value, reason, set_at, set_by
     FROM school_overrides WHERE school_id = ? ORDER BY field`
  )
    .bind(schoolId)
    .all<OverrideRow>();
  return results;
}

/** Lays a school's overrides over the row that was scraped. */
export function applyOverrides<T extends Record<string, unknown>>(
  school: T,
  rows: OverrideRow[] | undefined
): T {
  if (!rows?.length) return school;
  const out: Record<string, unknown> = { ...school };
  for (const row of rows) {
    if (row.value === null) {
      out[row.field] = null;
      continue;
    }
    try {
      out[row.field] = JSON.parse(row.value);
    } catch {
      // A hand-edited row should not take down the page it appears on.
    }
  }
  return out as T;
}

/** Text from a form to the shape the field is stored in. An empty box means
 *  "blank this", which is not the same as having no override at all. */
export function parseValue(field: string, raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (ARRAY_FIELDS.has(field)) {
    const list = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return JSON.stringify(list);
  }
  if (NUMBER_FIELDS.has(field)) {
    const n = Number(text.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? JSON.stringify(n) : null;
  }
  return JSON.stringify(text);
}

/** The stored shape back to something a form field can show. */
export function displayValue(value: string | null): string {
  if (value === null) return "";
  try {
    const v = JSON.parse(value);
    if (Array.isArray(v)) return v.join(", ");
    return v === null ? "" : String(v);
  } catch {
    return "";
  }
}

export async function setOverride(
  schoolId: number,
  field: string,
  value: string | null,
  reason: string,
  userId: number | null
): Promise<void> {
  await DB.prepare(
    `INSERT INTO school_overrides (school_id, field, value, reason, set_by, set_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(school_id, field) DO UPDATE SET
       value = excluded.value,
       reason = excluded.reason,
       set_by = excluded.set_by,
       set_at = excluded.set_at`
  )
    .bind(schoolId, field, value, reason, userId, new Date().toISOString())
    .run();
}

/** Drops a correction, so the scraped value shows again. */
export async function clearOverride(schoolId: number, field: string): Promise<void> {
  await DB.prepare("DELETE FROM school_overrides WHERE school_id = ? AND field = ?")
    .bind(schoolId, field)
    .run();
}
