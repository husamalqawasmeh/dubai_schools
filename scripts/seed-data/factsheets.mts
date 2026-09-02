/**
 * KHDA fact-sheet ingest — per-grade fees.
 *
 *   node --use-system-ca scripts/seed-data/factsheets.mts [--limit N] [--refresh] [--probe]
 *
 * The school detail pages carry one "Fact Sheet" link per grade, and each of
 * those pages holds what the directory listing does not: the tuition fee for
 * that single grade in the CURRENT academic year, the mandatory extras, the
 * supplies, the optional services (transport included), the increase policy
 * and the sibling discounts.
 *
 * This is where the good fee data lives. The listing page's range is a summary
 * and, for most schools, is years out of date — the listing said 2023-2024
 * where the fact sheets say 2026-2027.
 *
 * Fact-sheet URLs are read out of the detail pages already in .cache, so this
 * costs no extra requests to find them. Only the fact sheets themselves are
 * fetched, and those are cached too.
 *
 * --use-system-ca is required: web.khda.gov.ae serves an incomplete
 * certificate chain that Node's bundled CA list rejects.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const CACHE_DIR = join(HERE, ".cache");
const OUT_FILE = join(REPO, "src", "data", "grade-fees.json");

const BASE = "https://web.khda.gov.ae/en/Education-Directory/Schools/School-Details/Fact-Sheet";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) dubai-schools-explorer/seed-data";

// A government site — but KHDA serves a fact sheet in ~15s, so the throttle
// is their latency, not ours. Six in flight is about 0.4 requests a second
// sustained, comparable to a handful of people browsing the directory, and it
// turns a 6.7-hour run into roughly two. Override with --concurrency if a run
// needs to be gentler still.
const CONCURRENCY = Number(
  process.argv[process.argv.indexOf("--concurrency") + 1] || 0
) || 6;
const DELAY_MS = 250;
const MAX_RETRIES = 3;

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const value = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMIT = Number(value("limit") ?? "0") || 0;
const RESUME = flag("resume");
const REFRESH = flag("refresh");
const PROBE = flag("probe");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCached(url: string): Promise<string> {
  const key = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const path = join(CACHE_DIR, `${key}.html`);
  if (!REFRESH && existsSync(path)) return readFile(path, "utf8");

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(path, text, "utf8");
      return text;
    } catch (err) {
      lastErr = err;
      await sleep(DELAY_MS * (attempt + 1) * 2);
    }
  }
  throw lastErr;
}

/* -------------------------------------------------------------------------- */
/* parsing                                                                     */
/* -------------------------------------------------------------------------- */

/** The fact sheet is a run of label/value text nodes in document order, so it
 *  parses as a flat token list rather than a tree. */
function tokens(html: string): string[] {
  const body = html.slice(html.indexOf("</style>"));
  return body
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]*>/g, "|")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .split("|")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const isMoney = (s: string) => /^[\d,]+(\s*to\s*[\d,]+)?$/i.test(s);
const num = (s: string): number | null => {
  const m = s.replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

/** Value that follows a label, skipping the "(AED)" and note-in-brackets noise. */
function after(t: string[], label: string, within = 6): string | null {
  const i = t.findIndex((x) => x === label || x === label + ":");
  if (i < 0) return null;
  for (let j = i + 1; j < Math.min(i + 1 + within, t.length); j++) {
    const v = t[j];
    if (v === "(AED)" || v.startsWith("(")) continue;
    return v;
  }
  return null;
}

/** Name/amount pairs between two section headings. */
function pairs(t: string[], from: string, to: string): { name: string; amount: string }[] {
  const a = t.findIndex((x) => x.startsWith(from));
  if (a < 0) return [];
  let b = t.findIndex((x, i) => i > a && x.startsWith(to));
  if (b < 0) b = t.length;
  const out: { name: string; amount: string }[] = [];
  for (let i = a + 1; i < b - 1; i++) {
    const name = t[i];
    const val = t[i + 1];
    if (!isMoney(name) && isMoney(val) && !name.startsWith("(") && name !== "(AED)") {
      out.push({ name, amount: val });
      i++;
    }
  }
  return out;
}

export interface GradeFee {
  centerId: string;
  currId: string;
  gradeId: string;
  sectionId: string;
  schoolName: string;
  academicYear: string | null;
  curriculum: string | null;
  grade: string | null;
  khdaRating: string | null;
  tuitionAed: number | null;
  totalAed: number | null;
  mandatory: { name: string; amount: string }[];
  supplies: { name: string; amount: string }[];
  optional: { name: string; amount: string }[];
  transport: string | null;
  increasePolicy: string | null;
  discounts: string[];
}

function parse(html: string, ids: Record<string, string>): GradeFee | null {
  const t = tokens(html);
  const grade = after(t, "Grade:");
  if (!grade) return null; // not a fact sheet, or an empty one

  // The English school name is the token before "Academic Year:", after the
  // Arabic one. Fall back to whatever precedes it.
  const ay = t.findIndex((x) => x === "Academic Year:");
  const schoolName = ay > 0 ? t[ay - 1] : "";

  const optional = pairs(t, "Optional Services Fees", "Tuition Fees Increase Policy");
  const transport = optional.find((o) => /transport/i.test(o.name))?.amount ?? null;

  const policyIdx = t.findIndex((x) => x.startsWith("Tuition Fees Increase Policy"));
  const increasePolicy =
    policyIdx >= 0 && t[policyIdx + 1] && !t[policyIdx + 1].startsWith("Enrolment")
      ? t[policyIdx + 1]
      : null;

  const discIdx = t.findIndex((x) => x.startsWith("Other Discount Scheme"));
  const discounts: string[] = [];
  if (discIdx >= 0) {
    for (let i = discIdx + 1; i < Math.min(discIdx + 10, t.length); i++) {
      const v = t[i];
      if (/^(Share|×|WhatsApp|Email|Copy)$/i.test(v)) break;
      if (v.startsWith("(")) continue;
      discounts.push(v);
    }
  }

  const tuitionRaw = after(t, "Tuition Fees", 4);

  return {
    ...(ids as any),
    schoolName,
    academicYear: after(t, "Academic Year:"),
    curriculum: after(t, "Curriculum:"),
    grade,
    khdaRating: after(t, "KHDA Rating:"),
    tuitionAed: tuitionRaw && isMoney(tuitionRaw) ? num(tuitionRaw) : null,
    totalAed: num(after(t, "Total Fees", 4) ?? ""),
    mandatory: pairs(t, "Mandatory Fees", "Total Fees"),
    supplies: pairs(t, "Required Education Supplies", "Optional Services Fees"),
    optional,
    transport,
    increasePolicy,
    discounts,
  };
}

/* -------------------------------------------------------------------------- */
/* run                                                                         */
/* -------------------------------------------------------------------------- */

/** Every fact-sheet URL referenced by the detail pages already in .cache. */
async function collectUrls(): Promise<Record<string, string>[]> {
  const files = (await readdir(CACHE_DIR)).filter((f) => f.endsWith(".html"));
  const seen = new Set<string>();
  const out: Record<string, string>[] = [];
  for (const f of files) {
    const html = await readFile(join(CACHE_DIR, f), "utf8");
    if (!html.includes("Fact-Sheet")) continue;
    const re = /Fact-Sheet\?centerID=(\d+)&(?:amp;)?currID=(\d+)&(?:amp;)?gradeID=(\d+)&(?:amp;)?sectionID=(\d+)/g;
    for (const m of html.matchAll(re)) {
      const key = `${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ centerId: m[1], currId: m[2], gradeId: m[3], sectionId: m[4] });
    }
  }
  return out;
}

const urlFor = (i: Record<string, string>) =>
  `${BASE}?centerID=${i.centerId}&currID=${i.currId}&gradeID=${i.gradeId}&sectionID=${i.sectionId}&QR=1&ispreview=0`;

const targets = await collectUrls();
const work = LIMIT ? targets.slice(0, LIMIT) : targets;
console.log(`${targets.length} fact sheets referenced; fetching ${work.length}`);

const results: GradeFee[] = [];
let done = 0;
let failed = 0;

async function worker() {
  for (;;) {
    const item = work.shift();
    if (!item) return;
    try {
      const html = await fetchCached(urlFor(item));
      const row = parse(html, item);
      if (row) results.push(row);
      else failed++;
    } catch {
      failed++;
    }
    done++;
    if (done % 25 === 0) console.log(`  ${done} done, ${results.length} parsed, ${failed} skipped`);
    await sleep(DELAY_MS);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

if (PROBE) {
  console.log(JSON.stringify(results.slice(0, 3), null, 2));
} else {
  results.sort((a, b) => a.schoolName.localeCompare(b.schoolName) || a.grade!.localeCompare(b.grade!));
  await writeFile(OUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nwrote ${results.length} grade rows to ${OUT_FILE} (${failed} skipped)`);
  const years = new Map<string, number>();
  for (const r of results) years.set(r.academicYear ?? "?", (years.get(r.academicYear ?? "?") ?? 0) + 1);
  console.log("academic years:", [...years.entries()].sort().map(([k, v]) => `${k}=${v}`).join("  "));
  console.log("with transport:", results.filter((r) => r.transport).length);
  console.log("schools covered:", new Set(results.map((r) => r.schoolName)).size);
}
