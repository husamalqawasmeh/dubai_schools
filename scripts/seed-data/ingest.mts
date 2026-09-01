/**
 * KHDA school directory ingest.
 *
 *   npm run seed:schools -- [--limit N] [--refresh] [--dry-run]
 *
 * The --use-system-ca flag in that npm script is required: web.khda.gov.ae
 * serves an incomplete certificate chain, which the OS trust store can complete
 * but Node's bundled CA list cannot.
 *
 * Source: KHDA's public education directory. The listing page is fully
 * server-rendered and carries every registered private school in Dubai; each
 * row links to a detail page holding the overall DSIB inspection rating and the
 * published fee range.
 *
 *   listing -> https://web.khda.gov.ae/en/Education-Directory/Schools
 *   detail  -> .../Schools/School-Details?Id=<id>&CenterID=<centerId>
 *
 * Responses are cached to scripts/seed-data/.cache so re-runs cost no requests.
 * Requests are throttled and retried; this hits a government site, so keep the
 * concurrency low.
 *
 * Run with --refresh to bypass the cache when KHDA publishes new inspections.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  factualSummary,
  formatGradeRange,
  normalizeCurricula,
  normalizeRating,
  parseAed,
  slugify,
  titleCase,
  type Curriculum,
  type KhdaRating,
} from "./normalize.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const CACHE_DIR = join(HERE, ".cache");
const OUT_FILE = join(REPO, "src", "data", "schools.json");

const BASE = "https://web.khda.gov.ae/en/Education-Directory/Schools";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) dubai-schools-explorer/seed-data";

const CONCURRENCY = 2;
const DELAY_MS = 500;
const MAX_RETRIES = 3;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const LIMIT = Number(value("limit") ?? "0") || 0;
const REFRESH = flag("refresh");
const DRY_RUN = flag("dry-run");

/* -------------------------------------------------------------------------- */
/* fetching                                                                    */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCached(url: string): Promise<string> {
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const path = join(CACHE_DIR, `${key}.html`);

  if (!REFRESH && existsSync(path)) return readFile(path, "utf8");

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (html.length < 5_000) throw new Error(`suspiciously short (${html.length}b)`);
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(path, html, "utf8");
      return html;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) await sleep(1_000 * attempt * attempt);
    }
  }
  const cause = (lastError as { cause?: { code?: string } })?.cause?.code;
  if (cause === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    throw new Error(
      "TLS chain could not be verified. Run via `npm run seed:schools` so Node " +
        "starts with --use-system-ca (KHDA omits an intermediate certificate)."
    );
  }
  throw new Error(`failed after ${MAX_RETRIES} tries: ${url} — ${lastError}`);
}

/** Runs tasks with bounded concurrency and a fixed gap between starts. */
async function pool<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

/* -------------------------------------------------------------------------- */
/* parsing                                                                     */
/* -------------------------------------------------------------------------- */

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

function pick(block: string, pattern: RegExp): string | null {
  const m = block.match(pattern);
  return m ? decode(m[1]) : null;
}

interface ListingRow {
  khdaId: string;
  centerId: string;
  name: string;
  area: string;
  phone: string | null;
  rawCurriculum: string;
  gradeRange: string;
}

function parseListing(html: string): ListingRow[] {
  const cards = html.split(/(?=<div data-schoolid=')/).slice(1);
  const rows: ListingRow[] = [];

  for (const card of cards) {
    const name = pick(card, /id="lnkName"[^>]*>([\s\S]*?)<\/a>/);
    const khdaId = pick(card, /data-schoolid='(\d+)'/);
    const centerId = pick(card, /data-educationcenterid='(\d+)'/);
    if (!name || !khdaId || !centerId) continue;

    rows.push({
      khdaId,
      centerId,
      name,
      area: pick(card, /id="lblArea"[^>]*>([\s\S]*?)<\/span>/) ?? "",
      phone: pick(card, /id="lblTelephone"[^>]*>([\s\S]*?)<\/span>/),
      rawCurriculum: pick(card, /id="lblCurriculums"[^>]*>([\s\S]*?)<\/span>/) ?? "",
      gradeRange: pick(card, /id="lblgradeRange"[^>]*>([\s\S]*?)<\/span>/) ?? "",
    });
  }
  return rows;
}

interface DetailInfo {
  khdaRating: KhdaRating;
  inspectionYear: string | null;
  feeMin: number | null;
  feeMax: number | null;
  feeAvg: number | null;
  website: string | null;
  email: string | null;
  principal: string | null;
}

function parseDetail(html: string): DetailInfo {
  // Overall rating sits in the single DSIB badge, labelled "Overall Rating".
  const badge = html.match(
    /khda-badge-single-dsib[\s\S]{0,400}?rating-text">([\s\S]*?)<\/span>[\s\S]{0,200}?rating-sub-text">([\s\S]*?)<\/span>/
  );
  const ratingLabel = badge ? decode(badge[2]) : "";
  const khdaRating = /overall rating/i.test(ratingLabel)
    ? normalizeRating(badge ? decode(badge[1]) : null)
    : "Not rated";

  const inspectionYear =
    pick(html, /id="lblLatestInspectionYear"[^>]*>([\s\S]*?)<\/span>/) ??
    (ratingLabel.match(/(\d{4}-\d{4})/)?.[1] ?? null);

  // Fee widget: <div class="fees-aed">AED 8,404<br>...Lowest Fee</div>
  const fees: Record<string, number | null> = {};
  for (const m of html.matchAll(
    /class="fees-aed"[\s\S]{0,240}?<\/span>([\s\S]{0,40}?)<br>[\s\S]{0,160}?(Lowest Fee|Highest Fee|Average Fee)/g
  )) {
    fees[m[2]] = parseAed(decode(m[1]));
  }

  const labelled = new Map<string, string>();
  for (const m of html.matchAll(
    /filter-details__label">([\s\S]*?)<\/span>[\s\S]{0,200}?filter-details__value"[^>]*>([\s\S]*?)<\/span>/g
  )) {
    labelled.set(decode(m[1]).toLowerCase(), decode(m[2]));
  }
  const labelValue = (needle: string) => {
    for (const [k, v] of labelled) if (k.includes(needle)) return v || null;
    return null;
  };

  return {
    khdaRating,
    inspectionYear,
    feeMin: fees["Lowest Fee"] ?? null,
    feeMax: fees["Highest Fee"] ?? null,
    feeAvg: fees["Average Fee"] ?? null,
    website: labelValue("visit"),
    email: labelValue("email"),
    principal: labelValue("principal"),
  };
}

/* -------------------------------------------------------------------------- */
/* output shape                                                                */
/* -------------------------------------------------------------------------- */

interface School {
  slug: string;
  name: string;
  area: string;
  curricula: Curriculum[];
  khdaRating: KhdaRating;
  feeMinAED: number;
  feeMaxAED: number;
  feeNote: string;
  gradeRange: string;
  website: string;
  address: string;
  description: string;
  khdaId: string;
  phone?: string;
}

function normalizeUrl(raw: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed || !/[a-z]/i.test(trimmed)) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function existingDescriptions(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const prev = JSON.parse(await readFile(OUT_FILE, "utf8")) as {
      slug?: string;
      name?: string;
      description?: string;
    }[];
    for (const s of prev) {
      // Only keep prose someone actually wrote, not a previous generated line.
      if (s.description && s.name && !/curriculum school in/i.test(s.description)) {
        map.set(s.name.toLowerCase(), s.description);
      }
    }
  } catch {
    /* first run, or no previous file */
  }
  return map;
}

/* -------------------------------------------------------------------------- */

async function main() {
  console.log("Fetching KHDA education directory…");
  const listingHtml = await fetchCached(BASE);
  let rows = parseListing(listingHtml);
  console.log(`  parsed ${rows.length} schools from the listing`);
  if (rows.length === 0) throw new Error("listing parse produced 0 rows — markup changed?");

  if (LIMIT > 0) {
    rows = rows.slice(0, LIMIT);
    console.log(`  --limit ${LIMIT}: fetching detail for ${rows.length} of them`);
  }

  console.log(`Fetching ${rows.length} detail pages (concurrency ${CONCURRENCY})…`);
  let done = 0;
  const failures: string[] = [];

  const details = await pool(rows, async (row) => {
    const url = `${BASE}/School-Details?Id=${row.khdaId}&CenterID=${row.centerId}`;
    try {
      const info = parseDetail(await fetchCached(url));
      if (++done % 25 === 0) console.log(`  ${done}/${rows.length}`);
      return info;
    } catch (err) {
      failures.push(`${row.name}: ${err instanceof Error ? err.message : err}`);
      done++;
      return null;
    }
  });

  const carried = await existingDescriptions();
  const usedSlugs = new Set<string>();
  const schools: School[] = [];

  rows.forEach((row, i) => {
    const d = details[i];
    const area = titleCase(row.area);
    const curricula = normalizeCurricula(row.rawCurriculum);
    const khdaRating = d?.khdaRating ?? "Not rated";
    const gradeRange = formatGradeRange(row.gradeRange);

    let slug = slugify(row.name);
    if (!slug) slug = `school-${row.khdaId}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${row.khdaId}`;
    usedSlugs.add(slug);

    // KHDA occasionally publishes a placeholder lower bound (one school lists
    // "AED 1"). No Dubai school charges under AED 1,000/year, so treat anything
    // below that as "not published" rather than passing it to the UI.
    const FEE_FLOOR = 1_000;
    const rawMin = d?.feeMin ?? 0;
    const feeMin = rawMin >= FEE_FLOOR ? rawMin : 0;
    const feeMax = (d?.feeMax ?? 0) >= FEE_FLOOR ? (d?.feeMax ?? 0) : 0;

    schools.push({
      slug,
      name: row.name,
      area,
      curricula,
      khdaRating,
      feeMinAED: feeMin,
      feeMaxAED: Math.max(feeMin, feeMax),
      feeNote:
        feeMax === 0
          ? "Fees not published by KHDA"
          : feeMin === 0
            ? `Upper fee only${d?.inspectionYear ? `, ${d.inspectionYear}` : ""}`
            : `Published KHDA range${d?.inspectionYear ? `, ${d.inspectionYear}` : ""}`,
      gradeRange,
      website: normalizeUrl(d?.website ?? null),
      address: area ? `${area}, Dubai` : "Dubai",
      description:
        carried.get(row.name.toLowerCase()) ??
        factualSummary({ curricula, area, gradeRange, khdaRating }),
      khdaId: row.khdaId,
      // Deliberately omitting the staff email and principal name KHDA also
      // publishes: personal data the app has no use for, and this JSON is
      // shipped to the browser.
      ...(row.phone ? { phone: row.phone } : {}),
    });
  });

  schools.sort((a, b) => a.name.localeCompare(b.name));

  /* ---- report ---- */
  const withFees = schools.filter((s) => s.feeMinAED > 0).length;
  const withRating = schools.filter((s) => s.khdaRating !== "Not rated").length;
  const withSite = schools.filter((s) => s.website).length;
  const carriedOver = schools.filter((s) =>
    carried.has(s.name.toLowerCase())
  ).length;

  console.log("\n--- summary ---");
  console.log(`  schools            ${schools.length}`);
  console.log(`  with fee range     ${withFees}`);
  console.log(`  with KHDA rating   ${withRating}`);
  console.log(`  with website       ${withSite}`);
  console.log(`  kept prior prose   ${carriedOver}`);
  const byCurriculum = new Map<string, number>();
  for (const s of schools)
    for (const c of s.curricula) byCurriculum.set(c, (byCurriculum.get(c) ?? 0) + 1);
  console.log(
    "  curricula          " +
      [...byCurriculum.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `${c}:${n}`)
        .join(", ")
  );
  if (failures.length) {
    console.log(`\n  ${failures.length} detail fetch failures:`);
    for (const f of failures.slice(0, 10)) console.log("   -", f);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: not writing. Sample:");
    console.log(JSON.stringify(schools.slice(0, 2), null, 2));
    return;
  }

  await writeFile(OUT_FILE, JSON.stringify(schools, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${schools.length} schools to src/data/schools.json`);
}

main().catch((err) => {
  console.error("\nIngest failed:", err);
  process.exit(1);
});
