/**
 * Pulls each school's KHDA-published principal out of the detail pages already
 * in .cache. No requests are made.
 *
 *   node scripts/seed-data/principals.mts [--probe]
 *
 * KHDA prints the principal in the same labelled facts block as the phone and
 * the email, so this is the same parse as emails.mts and joins to a school the
 * same way: the page's Fact-Sheet link carries a centerID, and grade-fees.json
 * maps centerID to a school name.
 *
 * The name is the person holding a public, named office at a licensed school,
 * published by the regulator. It is stored as printed apart from case: KHDA
 * shouts some of them (HIREN PRAVINBHAI SANGANI) and title-cases others, and a
 * page that mixes the two looks broken.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const CACHE_DIR = join(HERE, ".cache");
const OUT_FILE = join(REPO, "src", "data", "school-principals.json");
const PROBE = process.argv.includes("--probe");

const gradeFees = JSON.parse(
  await readFile(join(REPO, "src", "data", "grade-fees.json"), "utf8")
) as { centerId: string; schoolName: string }[];

const centerToName = new Map<string, string>();
for (const g of gradeFees) if (!centerToName.has(g.centerId)) centerToName.set(g.centerId, g.schoolName);

/** ALL CAPS and all lower both become Title Case; anything already mixed is
 *  left alone, because that is someone's own capitalisation (de Silva, McRae). */
function tidy(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  const mixed = /[a-z]/.test(name) && /[A-Z]/.test(name);
  if (mixed) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s'\-.])([a-z])/g, (_, p, ch) => p + ch.toUpperCase());
}

const files = (await readdir(CACHE_DIR)).filter((f) => f.endsWith(".html"));

const seen = new Set<string>();
const rows: { centerId: string; schoolName: string; principal: string }[] = [];
let details = 0;
let noCenter = 0;
let noPrincipal = 0;

for (const f of files) {
  const html = await readFile(join(CACHE_DIR, f), "utf8");
  if (!html.includes("filter-details__label")) continue;
  details++;

  const center = html.match(/Fact-Sheet\?centerID=(\d+)/)?.[1];
  if (!center) { noCenter++; continue; }
  if (seen.has(center)) continue;

  // The label carries a "man" icon glyph before the word, and the value that
  // follows is wrapped in <address>. Anchor on the label so a school whose
  // name happens to contain "Principal" cannot be mistaken for one.
  const block = html.match(
    /filter-details__label[\s\S]{0,200}?Principal\s*<\/span>\s*<span class="filter-details__value">([\s\S]{0,300}?)<\/span>/i
  )?.[1];
  const principal = block ? tidy(block.replace(/<[^>]*>/g, " ")) : "";

  if (!principal || principal.length < 3) { noPrincipal++; continue; }

  seen.add(center);
  rows.push({ centerId: center, schoolName: centerToName.get(center) ?? "", principal });
}

rows.sort((a, b) => a.schoolName.localeCompare(b.schoolName));

console.log(`detail pages     ${details}`);
console.log(`no centerID      ${noCenter}`);
console.log(`no principal     ${noPrincipal}`);
console.log(`principals found ${rows.length}`);
console.log(`unmatched name   ${rows.filter((r) => !r.schoolName).length}`);
console.log(rows.slice(0, 6).map((r) => `  ${r.principal}  —  ${r.schoolName}`).join("\n"));

if (!PROBE) {
  await writeFile(OUT_FILE, JSON.stringify(rows, null, 2) + "\n");
  console.log(`\nwrote ${OUT_FILE}`);
}
