import { env } from "cloudflare:workers";

/**
 * The published news, grouped for the two news pages.
 *
 * Shared because both pages want the same three bands in the same order and
 * only differ in what the first one means — a school's own news on the schools'
 * page, a favourite school's news on the parents' one. Two copies of this would
 * have drifted the first time a rule changed.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

export interface NewsRow {
  id: number;
  headline: string;
  body: string | null;
  source_name: string | null;
  source_url: string | null;
  source_final_url: string | null;
  source_published_at: string | null;
  published_at: string;
  scanned_at: string | null;
  school_id: number | null;
  school_name: string | null;
  slug: string | null;
}

export async function publishedNews(limit = 120): Promise<NewsRow[]> {
  const { results } = await DB.prepare(
    `SELECT n.id, n.headline, n.body, n.source_name, n.source_url, n.source_final_url,
            n.source_published_at, n.published_at, n.scanned_at,
            n.school_id, s.name AS school_name, s.slug
       FROM school_news n
       LEFT JOIN schools s ON s.id = n.school_id
      WHERE n.published_at IS NOT NULL
      ORDER BY COALESCE(n.source_published_at, n.published_at) DESC, n.id DESC
      LIMIT ?`
  )
    .bind(limit)
    .all<NewsRow>();
  return results ?? [];
}

/**
 * The date to print at the front of a line.
 *
 * The newspaper's own date when we have it, and the date we found the story
 * when we do not — anything scanned before that column existed has no source
 * date and never will. `exact` says which of the two it is, so the page can
 * mark the fallback rather than passing our date off as theirs.
 */
export function newsDate(r: NewsRow): { label: string; exact: boolean } {
  const raw = r.source_published_at ?? r.published_at;
  const d = new Date(raw);
  const ok = !Number.isNaN(d.getTime());
  return {
    label: ok
      ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—",
    exact: Boolean(r.source_published_at) && ok,
  };
}

/** Where the line should link. The resolved article when the runner managed to
 *  find it, otherwise the Google News wrapper — which still reaches the piece,
 *  it just cannot say whose page it is until it opens. */
export const newsHref = (r: NewsRow): string | null => r.source_final_url ?? r.source_url;

/**
 * Which of the three bands an item belongs to.
 *
 * `own` is decided by the caller, because only the caller knows whose it is.
 * Between the other two: anything tied to a listed school, or naming Dubai,
 * KHDA or the UAE, is local. The rest is schooling news that reached the scan
 * without being about here — worth keeping, not worth leading with.
 */
const LOCAL = /\b(dubai|khda|uae|emirat|sharjah|abu dhabi|ajman)\b/i;

export function isLocal(r: NewsRow): boolean {
  if (r.school_id) return true;
  return LOCAL.test(`${r.headline} ${r.body ?? ""} ${r.source_name ?? ""}`);
}

export interface Bands {
  own: NewsRow[];
  local: NewsRow[];
  other: NewsRow[];
}

/** Splits the feed three ways. `ownIds` is the set of school ids the reader has
 *  a claim on — one school, several favourites, or none at all. */
export function band(rows: NewsRow[], ownIds: Set<number>): Bands {
  const own: NewsRow[] = [];
  const local: NewsRow[] = [];
  const other: NewsRow[] = [];
  for (const r of rows) {
    if (r.school_id && ownIds.has(r.school_id)) own.push(r);
    else if (isLocal(r)) local.push(r);
    else other.push(r);
  }
  return { own, local, other };
}
