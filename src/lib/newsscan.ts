import { env } from "cloudflare:workers";

/**
 * The morning news scan.
 *
 * WHY THE FETCHING IS NOT HERE
 * ----------------------------
 * It was, and Google answered every request with 503 — it refuses Cloudflare's
 * egress the way Anthropic refuses it. So scripts/fetch-news.mjs does the
 * fetching from the GitHub runner and posts the headlines here. This half does
 * what only it can: reads the database to know what has been seen, summarises,
 * writes drafts, and sends the digest.
 *
 * The source is Google News search feeds rather than the outlets directly. I
 * tested the obvious ones first: Gulf News, The National, Arabian Business and
 * Gulf Today all 404 or refuse, and only Khaleej Times still advertises a live
 * RSS link. The aggregator covers those outlets and the trade press besides.
 *
 * WHAT THIS DOES NOT DO
 * ---------------------
 * Social media. X's API is paid and its free tier cannot search; Facebook and
 * Instagram do not expose public search at all. Any "social scan" would be
 * scraping against their terms and would break the first time a layout changed.
 * If social coverage is wanted it needs a paid listening tool, and that is a
 * purchase rather than a feature.
 *
 * Nothing here publishes. Every item lands as a draft with published_at NULL
 * and reaches the site only when a link in the morning email is clicked.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

/** One headline as the runner found it. */
export interface Candidate {
  headline: string;
  url: string;
  source: string;
  published: string;
}

/** How many survive to the summariser. The model call is the only part that
 *  costs money, so the cheap filters run first. */
const MAX_CANDIDATES = 30;

/** Cheap relevance gate, before anything is paid for. A headline about a
 *  school in London is not news for this site. */
const MUST_MATCH = /\b(dubai|khda|uae|emirat)/i;
const TOPIC = /\b(school|schools|pupil|student|curricul|tuition|fee|fees|inspect|term|teacher|education|nursery|kindergarten)/i;

export interface ScanResult {
  fetched: number;
  candidates: number;
  inserted: number;
  skipped: number;
  drafts: { id: number; headline: string; body: string; source: string; url: string }[];
}

export async function scanNews(all: Candidate[]): Promise<ScanResult> {
  const relevant = all
    .filter((c) => MUST_MATCH.test(c.headline) && TOPIC.test(c.headline))
    .slice(0, MAX_CANDIDATES);

  // Anything already scanned — accepted or rejected — is not news again.
  const known = new Set<string>();
  if (relevant.length) {
    const marks = relevant.map(() => "?").join(",");
    const { results } = await DB.prepare(
      `SELECT source_url FROM school_news WHERE source_url IN (${marks})`
    )
      .bind(...relevant.map((c) => c.url))
      .all<{ source_url: string }>();
    for (const r of results ?? []) known.add(r.source_url);
  }

  const fresh = relevant.filter((c) => !known.has(c.url));
  if (!fresh.length) {
    return { fetched: all.length, candidates: relevant.length, inserted: 0, skipped: relevant.length, drafts: [] };
  }

  const summaries = await summarise(fresh);
  const now = new Date().toISOString();
  const drafts: ScanResult["drafts"] = [];

  // School matching happens here rather than in the INSERT. SQLite rejected
  // '%' || lower(name) || '%' as "LIKE or GLOB pattern too complex" — it will
  // not build a pattern out of column data per row. Doing it in JS is also
  // stricter: a name has to appear on a word boundary, so "Star" no longer
  // matches "Starlight".
  const { results: schoolRows } = await DB.prepare(
    "SELECT id, name FROM schools WHERE delisted_at IS NULL"
  ).all<{ id: number; name: string }>();
  const schools = (schoolRows ?? [])
    .map((s) => ({ id: s.id, name: s.name.toLowerCase() }))
    // Longest first, so "Dubai British School Jumeirah Park" wins over
    // "Dubai British School" when both appear.
    .sort((a, b) => b.name.length - a.name.length);

  const matchSchool = (headline: string): number | null => {
    const h = headline.toLowerCase();
    for (const s of schools) {
      if (s.name.length < 8) continue; // too short to be a safe match
      const at = h.indexOf(s.name);
      if (at < 0) continue;
      const before = at === 0 || /[^a-z0-9]/.test(h[at - 1]);
      const after = at + s.name.length >= h.length || /[^a-z0-9]/.test(h[at + s.name.length]);
      if (before && after) return s.id;
    }
    return null;
  };

  for (const s of summaries) {
    const c = fresh[s.i];
    if (!c) continue;
    try {
      const res = await DB.prepare(
        `INSERT INTO school_news
           (school_id, headline, body, source_name, source_url, scanned_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          matchSchool(`${c.headline} ${s.headline}`),
          s.headline,
          s.body,
          c.source || null,
          c.url,
          now,
          now
        )
        .run();
      const id = Number(res.meta?.last_row_id ?? 0);
      if (id) drafts.push({ id, headline: s.headline, body: s.body, source: c.source, url: c.url });
    } catch (err) {
      // A duplicate trips the unique index, which is the index doing its job.
      console.error("[newsscan] insert", err);
    }
  }

  return {
    fetched: all.length,
    candidates: relevant.length,
    inserted: drafts.length,
    skipped: relevant.length - fresh.length,
    drafts,
  };
}

/**
 * One model call for the whole batch. Asking per item would be thirty calls to
 * write thirty sentences, and the model is better at judging relevance when it
 * can see the day's stories together.
 */
async function summarise(
  items: Candidate[]
): Promise<{ i: number; headline: string; body: string }[]> {
  const key = (env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY;
  if (!key) {
    // Without a summariser the headline is still the story. Better a plain
    // digest than no digest.
    return items.map((c, i) => ({ i, headline: c.headline, body: "" }));
  }

  const list = items
    .map((c, i) => `${i}. ${c.headline}  [${c.source}, ${c.published}]`)
    .join("\n");

  const prompt = `Below are today's news headlines that mention Dubai and schooling.

For each one that is genuinely about schools or schooling in Dubai, write a
one or two sentence summary of what happened, in plain English, for parents
choosing a school.

Drop anything that is not really about Dubai schooling: property listings that
mention "near schools", university or corporate training news, opinion pieces
with no event in them, and stories about schools in other countries.

Reply with JSON only — an array of objects with keys "i" (the number in the
list), "headline" (a short factual headline, your own words, no source name)
and "body" (the summary). No other text.

${list}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "user-agent": "dubai-schools/1.0 (+https://dubai-schools.can-du-ai.com)",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[newsscan] summarise", res.status);
      return items.map((c, i) => ({ i, headline: c.headline, body: "" }));
    }

    const data = (await res.json()) as any;
    const text = (data.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    const open = text.indexOf("[");
    const close = text.lastIndexOf("]");
    if (open < 0 || close <= open) {
      // No array in the reply. Falling through to the headlines keeps the
      // digest coming; throwing here lost the entire morning's batch.
      console.error("[newsscan] summarise: no JSON array in reply", text.slice(0, 160));
      return items.map((c, i) => ({ i, headline: c.headline, body: "" }));
    }
    const parsed = JSON.parse(text.slice(open, close + 1)) as
      { i: number; headline: string; body: string }[];
    return parsed.filter(
      (p) => typeof p.i === "number" && p.i >= 0 && p.i < items.length && p.headline
    );
  } catch (err) {
    console.error("[newsscan] summarise", err);
    return items.map((c, i) => ({ i, headline: c.headline, body: "" }));
  }
}

/** Signs one decision so an approve link works from an inbox without a
 *  session, and only for the item it was minted for. */
export async function sign(id: number, action: string): Promise<string | null> {
  const secret = (env as unknown as { NEWS_SCAN_TOKEN?: string }).NEWS_SCAN_TOKEN;
  // WebCrypto rejects a zero-length HMAC key, so an unset secret threw a 500
  // where it should have been a refusal. No secret means no valid signature
  // exists, which is exactly what null says.
  if (!secret) return null;
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${action}:${id}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
