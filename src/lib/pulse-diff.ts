/**
 * Turning a Dubai Pulse row into findings.
 *
 * Kept apart from the fetching so it can be reasoned about — and changed —
 * without credentials. The field names below are written against the dataset
 * descriptions rather than a live response, because the API will not answer an
 * unregistered caller; anything unrecognised is reported as `new_field` rather
 * than dropped, which is exactly the behaviour that makes a wrong guess here
 * harmless. A guess that misses shows up in the queue as a field to look at.
 */

/** Pulse attribute -> our column. Compared after normalising, so
 *  "School_Name", "school name" and "schoolName" all land on the same key. */
export const FIELD_MAP: Record<string, string> = {
  schoolname: "name",
  name: "name",
  arabicname: "name_ar",
  area: "area",
  community: "area",
  curriculum: "curricula",
  curriculumname: "curricula",
  rating: "khda_rating",
  inspectionrating: "khda_rating",
  khdarating: "khda_rating",
  studentstotal: "students_total",
  totalstudents: "students_total",
  enrollment: "students_total",
  numberofstudents: "students_total",
  website: "website",
  schoolwebsite: "website",
  phone: "phone",
  telephone: "phone",
  contactnumber: "phone",
  email: "khda_email",
  address: "address",
  location: "address",
  latitude: "lat",
  longitude: "lng",
  principal: "principal",
  principalname: "principal",
  graderange: "grade_range",
  gradefrom: "grade_range",
  gradeto: "grade_range",
};

/** Attributes that are Pulse's own bookkeeping, not facts about a school.
 *  Reporting these would fill the queue with rows nobody can act on. */
const NOISE = new Set([
  "id", "objectid", "rowid", "fid", "shape", "geometry",
  "createddate", "modifieddate", "lastupdated", "updateddate",
  "datasetname", "entity", "recordid",
]);

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Comparison for "do these say the same thing". Case, spacing, punctuation and
 *  a trailing ".0" on a number all count as the same — otherwise the queue
 *  fills with findings that are only formatting. */
const same = (a: unknown, b: unknown) => {
  const c = (v: unknown) =>
    v === null || v === undefined
      ? ""
      : String(v).trim().toLowerCase().replace(/\.0+$/, "").replace(/\s+/g, " ");
  return c(a) === c(b);
};

export type Finding = {
  kind: "new_school" | "new_field" | "changed_value";
  field: string;
  pulse_value: string | null;
  our_value: string | null;
};

/**
 * One Pulse row against one of our schools.
 *
 * `ours` is null when Pulse lists a school we do not have — the single most
 * useful thing this scan can find, so it is reported as one finding rather than
 * one per attribute, which would bury the queue under a school we might not
 * even want to list.
 */
export function diffRow(
  row: Record<string, unknown>,
  ours: Record<string, unknown> | null
): Finding[] {
  if (!ours) {
    return [{ kind: "new_school", field: "name", pulse_value: pickName(row), our_value: null }];
  }

  const out: Finding[] = [];
  for (const [rawKey, rawVal] of Object.entries(row)) {
    const k = norm(rawKey);
    if (NOISE.has(k)) continue;
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === "") continue;

    const col = FIELD_MAP[k];
    if (!col) {
      // Pulse carries something we have nowhere to put. Worth a decision:
      // it is the answer to "what does Pulse have that KHDA's site does not".
      out.push({ kind: "new_field", field: rawKey, pulse_value: String(rawVal), our_value: null });
      continue;
    }

    const mine = ours[col];
    // We hold nothing here — Pulse is filling a gap, not contradicting us.
    if (mine === null || mine === undefined || String(mine).trim() === "") {
      out.push({ kind: "new_field", field: rawKey, pulse_value: String(rawVal), our_value: null });
      continue;
    }
    if (!same(mine, rawVal)) {
      out.push({
        kind: "changed_value",
        field: rawKey,
        pulse_value: String(rawVal),
        our_value: String(mine),
      });
    }
  }
  return out;
}

export function pickName(row: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(row)) {
    if (["schoolname", "name", "englishname"].includes(norm(k)) && v) return String(v).trim();
  }
  return null;
}

/** Match on the name, loosely. KHDA's own spellings drift between datasets —
 *  "The" comes and goes, "L.L.C" appears — so the key drops everything but
 *  letters and digits. Anything that still does not match is reported as a new
 *  school for a human to look at, which is the safe direction to fail in. */
export const matchKey = (name: string) =>
  name.toLowerCase().replace(/\b(the|llc|l\.l\.c|school|schools)\b/g, "").replace(/[^a-z0-9]/g, "");
