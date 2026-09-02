import { env } from "cloudflare:workers";

const DB = (env as unknown as { DB: D1Database }).DB;

/**
 * The whole directory as a compact table, appended to the system prompt so
 * every answer is grounded in the real listing rather than in what the model
 * remembers about Dubai schools.
 *
 * Built once per isolate and cached: it does not vary per request, which is
 * what makes it worth caching at the Anthropic end too — prompt caching is a
 * prefix match, so anything that changed per request would cost a full re-read
 * of the table every turn.
 *
 * Per-grade fees are NOT included. There are 3,108 of those rows and they
 * would dominate the context; the table carries each school's range and its
 * page, and the model is told to send people there for the grade breakdown.
 */
let cached: string | null = null;

export async function schoolContext(): Promise<string> {
  if (cached) return cached;

  const { results } = await DB.prepare(
    `SELECT s.name, s.area, s.curricula, s.khda_rating, s.fee_min_aed,
            s.fee_max_aed, s.fee_year, s.grade_range, s.slug, s.website,
            (SELECT MIN(tuition_aed) FROM grade_fees g WHERE g.school_id = s.id) AS g_min,
            (SELECT MAX(tuition_aed) FROM grade_fees g WHERE g.school_id = s.id) AS g_max,
            (SELECT academic_year FROM grade_fees g WHERE g.school_id = s.id LIMIT 1) AS g_year
     FROM schools s
     WHERE s.delisted_at IS NULL
     ORDER BY s.name`
  ).all<any>();

  const rows = results.map((r) => {
    let curricula = "";
    try {
      curricula = (JSON.parse(r.curricula) as string[]).join("/");
    } catch {
      curricula = "";
    }
    // Prefer the fact-sheet figures: they are per grade and current, where the
    // directory listing is a range and often years old.
    const min = r.g_min ?? r.fee_min_aed;
    const max = r.g_max ?? r.fee_max_aed;
    const year = r.g_year ?? r.fee_year;
    return [
      r.name,
      r.area,
      curricula,
      r.khda_rating,
      min ?? "n/a",
      max ?? "n/a",
      year ?? "n/a",
      r.grade_range || "n/a",
      `/schools/${r.slug}`,
    ].join("\t");
  });

  const header = [
    "name", "area", "curricula", "khda_rating",
    "fee_low_aed", "fee_high_aed", "fee_year", "grades", "page",
  ].join("\t");

  cached = `
# SITE DATA — every school currently listed

The table below is the complete directory as shown on the site right now
(${rows.length} schools). It is the ONLY source you may use for facts about a
named school. If a school is not in this table, say it is not listed rather
than answering from memory.

Columns are tab-separated. Reading it:
- "fee_low_aed" / "fee_high_aed" are the cheapest and dearest grade at that
  school, from KHDA's per-grade fee sheets where we have them. "n/a" means
  KHDA publishes no fee — say so rather than implying the school is free.
- "fee_year" is the academic year those fees are for. Most are 2026-2027, but
  a few are older. If you quote a fee, quote its year with it.
- "khda_rating" of "Not rated" means no inspection has happened yet, usually a
  new school. It does NOT mean a poor rating.
- "page" is the path on this site. When you name a school, point the reader to
  its page — the per-grade fee table, transport costs and sibling discounts
  are all there, and are not in this table.

${header}
${rows.join("\n")}
`.trim();

  return cached;
}

export const SYSTEM_PROMPT = `
You are the assistant on Dubai Schools, a directory of every private school
registered with KHDA in Dubai.

Scope: schools in Dubai — curricula, fees, KHDA inspection ratings, areas,
grades, admissions in general terms. If asked about something else, say that is
outside what you can help with and offer what you can.

Rules:
- Never invent a fee, a rating, or a school. Everything factual comes from the
  table below. If it is not there, say so.
- Quote fees with their academic year, and say they are KHDA's published
  figures which should be confirmed with the school.
- When you name a school, give its page path so the reader can open it.
- Per-grade fees, transport costs, supplies and sibling discounts live on each
  school's own page. Point there rather than guessing at them.
- You do not have parent reviews or opinions about school quality beyond
  KHDA's inspection rating. Do not offer any.

Tone: short, plain and useful. A parent comparing schools is busy. Two or three
sentences beats a page. Use a short list when comparing more than two schools.
`.trim();
