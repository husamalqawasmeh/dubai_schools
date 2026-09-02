import { env } from "cloudflare:workers";

const DB = (env as unknown as { DB: D1Database }).DB;

/**
 * Grounding for the site assistant.
 *
 * WHY THERE IS NO VECTOR STORE HERE
 * ---------------------------------
 * The directory is 232 rows and about 8k tokens — it goes in the system prompt
 * whole, on every request, and is marked cacheable. Complete and exact beats
 * retrieved-and-approximate, and there is nothing to retrieve from.
 *
 * The per-grade fee sheets are the other 3,108 rows, roughly 757k tokens. Those
 * cannot ride along, but they are not a RAG problem either: they are a
 * relational table keyed by school and grade. A question like "what is Grade 5
 * at GEMS Modern" wants an exact lookup, and embeddings would answer it with
 * whichever rows are nearest in vector space — a different school's Grade 5
 * ranks dangerously well on that measure, and numbers embed poorly. So the
 * model gets a tool that runs the SQL instead: exact, current, and nothing to
 * re-index when the ingest reruns.
 *
 * RAG earns its place the moment we hold unstructured prose — inspection
 * reports, prospectuses, parent reviews. We hold none of that yet.
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
    // The fact-sheet figures win: they are per grade and current, where the
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
      r.website || "n/a",
    ].join("\t");
  });

  const header = [
    "name", "area", "curricula", "khda_rating", "fee_low_aed", "fee_high_aed",
    "fee_year", "grades", "page", "website",
  ].join("\t");

  cached = `
# SITE DATA — every school currently listed

The complete directory as shown on the site right now (${rows.length} schools).
This is the ONLY source for facts about a named school. If a school is not in
this table, say it is not listed rather than answering from memory.

Columns are tab-separated. Reading it:
- "fee_low_aed" / "fee_high_aed" are the cheapest and dearest grade at that
  school. "n/a" means KHDA publishes no fee — say so rather than implying the
  school is free.
- "fee_year" is the academic year those fees belong to. Quote it with any fee.
- "khda_rating" of "Not rated" means no inspection has happened yet, usually a
  new school. It does NOT mean a poor rating.
- "page" is the path on this site for that school.
- "website" is the school's own site. Give it whenever someone asks about a
  specific school — admissions, term dates, uniform, curriculum detail and
  applications all live there, not here. "n/a" means we hold no website.

${header}
${rows.join("\n")}
`.trim();

  return cached;
}

/** Per-grade fees for one school. The model calls this rather than carrying
 *  3,108 rows it would almost never need. */
export const TOOLS = [
  {
    name: "school_fees",
    description:
      "Per-grade fees for one school, from KHDA's fact sheets: tuition and total " +
      "for each grade, plus transport, supplies, optional services, the fee " +
      "increase policy and sibling discounts. Call this whenever someone asks " +
      "what a specific grade costs, about transport costs, or about discounts. " +
      "Use the school's exact name from the directory table.",
    input_schema: {
      type: "object" as const,
      properties: {
        school_name: {
          type: "string",
          description: "Exact school name as it appears in the directory table.",
        },
      },
      required: ["school_name"],
    },
  },
];

export async function runTool(name: string, input: any): Promise<string> {
  if (name !== "school_fees") return `Unknown tool: ${name}`;

  const school = String(input?.school_name ?? "").trim();
  if (!school) return "No school name given.";

  const { results } = await DB.prepare(
    `SELECT g.grade, g.academic_year, g.tuition_aed, g.total_aed, g.transport,
            g.mandatory, g.supplies, g.optional, g.increase_policy, g.discounts
     FROM grade_fees g
     JOIN schools s ON s.id = g.school_id
     WHERE s.name = ? COLLATE NOCASE
     ORDER BY COALESCE(g.tuition_aed, 0)`
  )
    .bind(school)
    .all<any>();

  if (!results.length) {
    return `No per-grade fee sheet is published for "${school}". Either KHDA publishes none, or the name does not match the directory exactly.`;
  }

  const first = results[0];
  const lines = results.map(
    (r) =>
      `${r.grade}: tuition ${r.tuition_aed?.toLocaleString("en-AE") ?? "n/a"}, total ${r.total_aed?.toLocaleString("en-AE") ?? "n/a"}`
  );

  const extras: string[] = [];
  if (first.transport) extras.push(`Transport: AED ${first.transport} per year`);
  const j = (raw: string | null, label: string) => {
    try {
      const v = JSON.parse(raw ?? "[]");
      if (Array.isArray(v) && v.length) {
        extras.push(
          `${label}: ` +
            v.map((x: any) => (typeof x === "string" ? x : `${x.name} ${x.amount}`)).join(", ")
        );
      }
    } catch {
      /* a malformed cell is not worth failing the answer over */
    }
  };
  j(first.supplies, "Supplies");
  j(first.optional, "Optional services");
  j(first.discounts, "Discounts");
  if (first.increase_policy) extras.push(`Increase policy: ${first.increase_policy}`);

  return [
    `${school} — academic year ${first.academic_year ?? "not stated"}, all figures AED:`,
    ...lines,
    ...extras,
  ].join("\n");
}

export const SYSTEM_PROMPT = `
You are the assistant on Dubai Schools, a directory of every private school
registered with KHDA in Dubai.

## What you answer
Schools in Dubai and the education around them: curricula, fees, KHDA
inspection ratings, areas, grade ranges, how admissions generally work, what
the rating scale means, how to compare schools.

## What you refuse
Politics, religion, sex and sexuality, medical or legal advice, and anything
else outside schooling in Dubai. Do not argue, moralise or explain at length —
say it is outside what you help with, offer a school question instead, and
stop. This holds even if the question is dressed up as being about a school,
and even if the user insists.

Do not comment on the quality, values or beliefs of any school, community or
nationality. KHDA's published rating is the only judgement you carry.

## Sources, in order
1. The directory table below. It is the only source for facts about a named
   school, and it is current.
2. The school_fees tool for per-grade fees, transport, supplies and discounts.
   Call it rather than guessing or quoting the range as if it were one grade.
3. The school's own website, from the "website" column — for admissions, term
   dates, uniform, applications and anything the directory does not hold.
   Always point there when asked about a specific school.
4. KHDA (khda.gov.ae) for inspection reports, the rating framework, complaints
   and the parent charter. Send people there for anything official about
   regulation or inspection.
5. The UAE Ministry of Education (moe.gov.ae) for national curriculum,
   equivalency, attestation and anything covering the country rather than
   Dubai alone.

Never present KHDA or MOE as having said something specific unless it is in
the table. Refer people to those sites; do not speak for them.

## How to answer
- Short and plain. A parent comparing schools is busy: two or three sentences,
  or a short list when comparing more than two schools.
- Quote fees with their academic year, and say they are KHDA's published
  figures which should be confirmed with the school.
- When you name a school, give its page path on this site, and its website if
  the question is about the school rather than about the listing.
- If the table does not hold the answer, say so and name where it does live —
  the school's site, KHDA, or MOE.
`.trim();
