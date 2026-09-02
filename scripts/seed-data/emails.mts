/**
 * Pulls each school's KHDA-published contact address out of the detail pages
 * already in .cache. No requests are made.
 *
 *   node scripts/seed-data/emails.mts [--probe]
 *
 * These are work addresses on the school's own domain, published by KHDA in a
 * public directory. Free-mail providers are dropped: a gmail.com address is a
 * personal mailbox that happens to be listed, not an institutional one, and
 * mailing it is a different act from mailing admin@school.ae.
 *
 * A detail page does not name its school in a form worth parsing, but it does
 * carry Fact-Sheet links, and those carry a centerID. grade-fees.json already
 * maps centerID to a school name, so the join goes through there.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const CACHE_DIR = join(HERE, ".cache");
const OUT_FILE = join(REPO, "src", "data", "school-emails.json");
const PROBE = process.argv.includes("--probe");

/** Personal mailboxes that happen to be listed. Not institutional contacts. */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com",
  "hotmail.co.uk", "outlook.com", "live.com", "msn.com", "aol.com",
  "icloud.com", "me.com", "protonmail.com", "proton.me", "yandex.com",
  "mail.ru", "rediffmail.com", "ymail.com", "zoho.com", "gmx.com",
]);

const gradeFees = JSON.parse(
  await readFile(join(REPO, "src", "data", "grade-fees.json"), "utf8")
) as { centerId: string; schoolName: string }[];

const centerToName = new Map<string, string>();
for (const g of gradeFees) if (!centerToName.has(g.centerId)) centerToName.set(g.centerId, g.schoolName);

const files = (await readdir(CACHE_DIR)).filter((f) => f.endsWith(".html"));

interface Row {
  centerId: string;
  schoolName: string;
  email: string;
  domain: string;
  institutional: boolean;
}

const seen = new Set<string>();
const rows: Row[] = [];
let noCenter = 0;
let noEmail = 0;

for (const f of files) {
  const html = await readFile(join(CACHE_DIR, f), "utf8");
  // Detail pages carry the labelled facts block; fact sheets do not.
  if (!html.includes("filter-details__label")) continue;

  const center = html.match(/Fact-Sheet\?centerID=(\d+)/)?.[1];
  if (!center) { noCenter++; continue; }
  if (seen.has(center)) continue;

  // KHDA renders it as an accessible mailto link.
  const email = html
    .match(/href="mailto:([^"?@\s]+@[^"?\s]+)"/i)?.[1]
    ?.trim()
    .toLowerCase();
  if (!email || !email.includes("@")) { noEmail++; continue; }

  seen.add(center);
  const domain = email.split("@")[1] ?? "";
  rows.push({
    centerId: center,
    schoolName: centerToName.get(center) ?? "",
    email,
    domain,
    institutional: !FREE_MAIL.has(domain),
  });
}

rows.sort((a, b) => a.schoolName.localeCompare(b.schoolName));

const institutional = rows.filter((r) => r.institutional);
const free = rows.filter((r) => !r.institutional);
const named = rows.filter((r) => r.schoolName);

if (PROBE) {
  console.log(JSON.stringify(rows.slice(0, 10), null, 2));
} else {
  await writeFile(OUT_FILE, JSON.stringify(rows, null, 2), "utf8");
  console.log(`wrote ${rows.length} addresses to ${OUT_FILE}`);
}

console.log(`  detail pages scanned : ${seen.size + noEmail}`);
console.log(`  addresses found      : ${rows.length}`);
console.log(`  matched to a school  : ${named.length}`);
console.log(`  institutional (usable): ${institutional.length}`);
console.log(`  free-mail (dropped)  : ${free.length}`);
if (free.length) {
  const byDomain = new Map<string, number>();
  for (const r of free) byDomain.set(r.domain, (byDomain.get(r.domain) ?? 0) + 1);
  console.log("    " + [...byDomain.entries()].map(([d, n]) => `${d}=${n}`).join("  "));
}
console.log(`  pages with no email  : ${noEmail}`);
