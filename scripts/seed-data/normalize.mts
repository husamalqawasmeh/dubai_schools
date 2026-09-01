/**
 * Normalisation helpers shared by the KHDA ingest.
 *
 * KHDA publishes curriculum as free text with 31 distinct spellings across the
 * 232 schools ("UK (13 Y)", "UK*", "US/IB", "Ministry of Education \ BTEC",
 * comma-separated combinations, and so on). Everything below maps that raw text
 * onto the small canonical set the app filters by.
 */

import { KHDA_RATINGS, type Curriculum, type KhdaRating } from "../../src/types.ts";

export type { Curriculum, KhdaRating };

/** Ordered — the first matching rule wins per token, but a token may match
 *  several rules (e.g. "UK/IB" yields both British and IB). */
const CURRICULUM_RULES: [RegExp, Curriculum][] = [
  [/sabis/i, "SABIS"],
  [/ministry of education|\bmoe\b/i, "UAE MOE"],
  [/international baccalaureate|(^|[^a-z])ib([^a-z]|$)/i, "IB"],
  [/\buk\b|british|england|igcse|a-?level/i, "British"],
  [/american|(^|[^a-z])us([^a-z]|\/|$)/i, "American"],
  [/indian|cbse|icse/i, "Indian"],
  [/french|fran[cç]/i, "French"],
  [/german|deutsch/i, "German"],
  [/japan/i, "Japanese"],
  [/russia/i, "Russian"],
  [/chinese|china/i, "Chinese"],
  [/philipp?ine|filipino/i, "Philippine"],
  [/pakistan/i, "Pakistani"],
  [/australia/i, "Australian"],
  [/iran/i, "Iranian"],
  [/canad/i, "Canadian"],
];

export function normalizeCurricula(raw: string): Curriculum[] {
  const found = new Set<Curriculum>();
  // KHDA separates multiple curricula with commas; slashes appear *within* a
  // single qualification name ("UK/IB"), so both parts should count.
  for (const token of raw.split(",")) {
    const t = token.trim();
    if (!t) continue;
    for (const [pattern, value] of CURRICULUM_RULES) {
      if (pattern.test(t)) found.add(value);
    }
  }
  if (found.size === 0 && raw.trim()) found.add("Other");
  return [...found];
}

/** KHDA renders these with inconsistent casing ("Very good" vs "Very Good"). */
export function normalizeRating(raw: string | null | undefined): KhdaRating {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "Not rated";
  const match = KHDA_RATINGS.find((r) => r.toLowerCase() === t);
  return match ?? "Not rated";
}

/** "AL BARSHA FIRST" / "al barsha first" -> "Al Barsha First" */
export function titleCase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) =>
      // keep short connectors lowercase unless they lead the string
      /^(al|bin|the|of|and)$/.test(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(l\.?l\.?c|llc|f\.?z\.?e|branch)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function parseAed(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A factual one-line summary built purely from fields KHDA publishes.
 * KHDA supplies no prose description, and inventing one is not an option, so
 * this states only what the structured data already says.
 */
export function factualSummary(input: {
  curricula: Curriculum[];
  area: string;
  gradeRange: string;
  khdaRating: KhdaRating;
}): string {
  const curriculum =
    input.curricula.length > 0
      ? input.curricula.filter((c) => c !== "Other").join(" and ") ||
        "Private"
      : "Private";
  const parts = [`${curriculum} curriculum school in ${input.area}`];
  if (input.gradeRange) parts.push(`serving ${input.gradeRange}`);
  const sentence = parts.join(", ") + ".";
  return input.khdaRating !== "Not rated"
    ? `${sentence} Rated ${input.khdaRating} in its latest KHDA inspection.`
    : sentence;
}

/** KHDA shouts grade ranges ("FS 1 - YEAR 9"); keep real acronyms, title-case
 *  the rest so it reads properly in the UI. */
const GRADE_ACRONYMS = new Set(["FS", "KG", "ECC", "IB", "US", "UK", "PYP", "MYP", "DP"]);

export function formatGradeRange(raw: string): string {
  return raw
    .replace(/\\/g, "/")
    .trim()
    .toLowerCase()
    .replace(/[a-z]+/g, (word) =>
      GRADE_ACRONYMS.has(word.toUpperCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    );
}
