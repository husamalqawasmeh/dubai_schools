/**
 * Exports src/data/schools.json to CSV for use outside the app (Excel, Sheets,
 * another database). The JSON stays the source of truth; this is a portable
 * copy so the dataset is never trapped inside this repo.
 *
 *   npm run export:schools -- [outputDir]
 *
 * Default output: ./exports/
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { School } from "../../src/types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

const COLUMNS = [
  "slug",
  "name",
  "area",
  "curricula",
  "khdaRating",
  "feeMinAED",
  "feeMaxAED",
  "feeNote",
  "gradeRange",
  "website",
  "address",
  "phone",
  "khdaId",
  "description",
] as const;

/** RFC 4180: quote if the value contains a comma, quote, or newline. */
function csvCell(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : Array.isArray(value)
        ? value.join("; ")
        : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const outDir = resolve(process.argv[2] ?? join(REPO, "exports"));
  const schools = JSON.parse(
    await readFile(join(REPO, "src", "data", "schools.json"), "utf8")
  ) as School[];

  const rows = [
    COLUMNS.join(","),
    ...schools.map((s) =>
      COLUMNS.map((c) => csvCell((s as Record<string, unknown>)[c])).join(",")
    ),
  ];

  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = join(outDir, `dubai-schools-${stamp}.csv`);
  const jsonPath = join(outDir, `dubai-schools-${stamp}.json`);

  // BOM so Excel reads the UTF-8 correctly on Windows.
  await writeFile(csvPath, "﻿" + rows.join("\r\n") + "\r\n", "utf8");
  await writeFile(jsonPath, JSON.stringify(schools, null, 2) + "\n", "utf8");

  console.log(`Exported ${schools.length} schools`);
  console.log(`  ${csvPath}`);
  console.log(`  ${jsonPath}`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
