import { env } from "cloudflare:workers";
import { applyOverrides, overridesBySchool, overridesFor } from "./overrides";

/** The D1 binding, declared in wrangler.jsonc. */
const DB = (env as unknown as { DB: D1Database }).DB;

export type FeeBand = "acceptable" | "medium" | "high" | "very_high";

export interface SchoolRow {
  id: number;
  slug: string;
  name: string;
  area: string;
  curricula: string;        // JSON array as stored
  khda_rating: string;
  fee_min_aed: number | null;
  fee_max_aed: number | null;
  fee_year: string | null;
  fee_note: string | null;
  fee_band: FeeBand | null; // generated column; NULL when no fee is published
  grade_range: string | null;
  students_total: number | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  principal: string | null;
}

export interface School extends Omit<SchoolRow, "curricula"> {
  curricula: string[];
  /** Ours, not KHDA's: set by an admin, absent until one is. */
  motto?: string | null;
  highlights?: string | null;
  logo_url?: string | null;
}

function hydrate(row: SchoolRow): School {
  let curricula: string[] = [];
  try {
    curricula = JSON.parse(row.curricula);
  } catch {
    // A malformed row should not take down the page it appears on.
    curricula = [];
  }
  return { ...row, curricula };
}

const COLUMNS = `id, slug, name, area, curricula, khda_rating, fee_min_aed,
  fee_max_aed, fee_year, fee_note, fee_band, grade_range, students_total,
  website, phone, address, description, principal`;

export async function allSchools(): Promise<School[]> {
  // Two queries rather than a join: every school is wanted, and at this size
  // the corrections table is smaller than the rows it decorates.
  const [{ results }, overrides] = await Promise.all([
    DB.prepare(
      `SELECT ${COLUMNS} FROM schools WHERE delisted_at IS NULL ORDER BY name`
    ).all<SchoolRow>(),
    overridesBySchool(),
  ]);
  return results.map((row) => applyOverrides(hydrate(row), overrides.get(row.id)));
}

export async function schoolBySlug(slug: string): Promise<School | null> {
  const row = await DB.prepare(
    `SELECT ${COLUMNS} FROM schools WHERE slug = ? AND delisted_at IS NULL`
  )
    .bind(slug)
    .first<SchoolRow>();
  if (!row) return null;
  return applyOverrides(hydrate(row), await overridesFor(row.id));
}

/** The row as scraped, corrections and delisting ignored — what the admin
 *  screen has to show beside each correction to make it worth reading. */
export async function rawSchoolBySlug(slug: string): Promise<
  (School & { delisted_at: string | null; lat: number | null; lng: number | null }) | null
> {
  const row = await DB.prepare(
    `SELECT ${COLUMNS}, lat, lng, delisted_at FROM schools WHERE slug = ?`
  )
    .bind(slug)
    .first<SchoolRow & { lat: number | null; lng: number | null; delisted_at: string | null }>();
  if (!row) return null;
  return { ...hydrate(row), lat: row.lat, lng: row.lng, delisted_at: row.delisted_at };
}

export interface Stats {
  total: number;
  rated: number;
  priced: number;
  areas: number;
  curricula: number;
  bands: Record<string, number>;
  ratings: Record<string, number>;
  /** Per-curriculum counts, descending. Sums to more than `total`, because a
   *  school may run two curricula (British and IB, say). */
  curriculaCounts: { name: string; n: number }[];
}

/** Counted in the database rather than in JavaScript, so the headline figures
 *  can never drift from what the table actually contains. */
export async function stats(): Promise<Stats> {
  const [totals, bands, ratings] = await DB.batch<any>([
    DB.prepare(
      `SELECT COUNT(*) total,
              SUM(CASE WHEN khda_rating <> 'Not rated' THEN 1 ELSE 0 END) rated,
              COUNT(fee_max_aed) priced,
              COUNT(DISTINCT area) areas
       FROM schools WHERE delisted_at IS NULL`
    ),
    DB.prepare(
      `SELECT COALESCE(fee_band,'none') band, COUNT(*) n
       FROM schools WHERE delisted_at IS NULL GROUP BY fee_band`
    ),
    DB.prepare(
      `SELECT khda_rating rating, COUNT(*) n
       FROM schools WHERE delisted_at IS NULL GROUP BY khda_rating`
    ),
  ]);

  const t = totals.results[0];
  const bandMap: Record<string, number> = {};
  for (const r of bands.results) bandMap[r.band] = r.n;
  const ratingMap: Record<string, number> = {};
  for (const r of ratings.results) ratingMap[r.rating] = r.n;

  // Curricula are a JSON array per row, so this one is counted in JS.
  const { results } = await DB.prepare(
    `SELECT curricula FROM schools WHERE delisted_at IS NULL`
  ).all<{ curricula: string }>();
  const counts = new Map<string, number>();
  for (const r of results) {
    try {
      for (const c of JSON.parse(r.curricula)) counts.set(c, (counts.get(c) ?? 0) + 1);
    } catch {
      /* ignore a malformed row */
    }
  }

  return {
    total: t.total,
    rated: t.rated,
    priced: t.priced,
    areas: t.areas,
    curricula: counts.size,
    bands: bandMap,
    ratings: ratingMap,
    curriculaCounts: [...counts.entries()]
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n),
  };
}

/* -------------------------------------------------------------------------- */
/* Per-grade fees, from KHDA's fact sheets                                      */
/* -------------------------------------------------------------------------- */

export interface FeeItem {
  name: string;
  amount: string;
}

export interface GradeFee {
  grade: string;
  curriculum: string | null;
  academic_year: string | null;
  tuition_aed: number | null;
  total_aed: number | null;
  mandatory: FeeItem[];
  supplies: FeeItem[];
  optional: FeeItem[];
  transport: string | null;
  increase_policy: string | null;
  discounts: string[];
}

const parseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/**
 * Every grade KHDA publishes a fee sheet for, cheapest first. Ordered by
 * tuition rather than by grade name because KHDA's grade labels are not
 * sortable text — "KG 1", "FS 2", "Year 10" and "Grade 3" all coexist, and
 * fee order happens to track school stage closely enough to read naturally.
 */
export async function gradeFees(schoolId: number): Promise<GradeFee[]> {
  const { results } = await DB.prepare(
    `SELECT grade, curriculum, academic_year, tuition_aed, total_aed,
            mandatory, supplies, optional, transport, increase_policy, discounts
     FROM grade_fees
     WHERE school_id = ?
     ORDER BY COALESCE(tuition_aed, 0), grade`
  )
    .bind(schoolId)
    .all<any>();

  return results.map((r) => ({
    grade: r.grade,
    curriculum: r.curriculum,
    academic_year: r.academic_year,
    tuition_aed: r.tuition_aed,
    total_aed: r.total_aed,
    mandatory: parseJson<FeeItem[]>(r.mandatory, []),
    supplies: parseJson<FeeItem[]>(r.supplies, []),
    optional: parseJson<FeeItem[]>(r.optional, []),
    transport: r.transport,
    increase_policy: r.increase_policy,
    discounts: parseJson<string[]>(r.discounts, []),
  }));
}
