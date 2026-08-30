import schoolsData from "@/data/schools.json";
import { School } from "@/types";

const schools = schoolsData as School[];

/**
 * The whole directory, trimmed to the fields a chat answer actually needs, as a
 * compact TSV. At 232 rows this is ~10K tokens — small enough to sit in the
 * system prompt, so every answer is grounded in the real KHDA data without a
 * vector store or a retrieval step.
 *
 * This string is built once at module load and never varies, which is what
 * makes it cacheable: prompt caching is a prefix match, so anything that
 * changed per request would cost a full re-read every turn.
 */
function buildSchoolTable(): string {
  const header = [
    "name",
    "area",
    "curricula",
    "khda_rating",
    "fee_min_aed",
    "fee_max_aed",
    "grades",
    "page",
  ].join("\t");

  const rows = schools.map((s) =>
    [
      s.name,
      s.area,
      s.curricula.join("/"),
      s.khdaRating,
      s.feeMinAED || "n/a",
      s.feeMaxAED || "n/a",
      s.gradeRange || "n/a",
      `/schools/${s.slug}`,
    ].join("\t")
  );

  return [header, ...rows].join("\n");
}

const SCHOOL_TABLE = buildSchoolTable();

export const SCHOOL_CONTEXT = `
# SITE DATA — every school currently listed

The table below is the complete directory as shown on the site right now
(${schools.length} schools). It is the ONLY source you may use for facts about a
named school. If a school is not in this table, say it is not listed rather
than answering from memory.

Columns are tab-separated. Notes on reading it:
- "fee_min_aed" / "fee_max_aed" are the annual fee range KHDA publishes.
  "n/a" means KHDA publishes no fee for that school — say so rather than
  guessing or implying the school is free.
- "khda_rating" of "Not rated" means no inspection has happened yet, which
  usually indicates a newly opened school. It does NOT mean a poor rating.
- "page" is the path on this site for that school. When you name a school,
  point the user to its page using that path.

${SCHOOL_TABLE}
`.trim();
