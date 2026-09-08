/**
 * Suppliers and services that register themselves.
 *
 * The categories live here rather than in either page, because the public form
 * writes them and the admin screen and the listing both read them back — three
 * copies of a list like this drift, and the one that drifts is always the
 * validator, which then starts rejecting things the form offered.
 */
export const CATEGORIES = [
  { id: "uniforms", label: "Uniforms" },
  { id: "books", label: "Textbooks" },
  { id: "used_books", label: "Second-hand books" },
  { id: "stationery", label: "Stationery and equipment" },
  { id: "transport", label: "Transport" },
  { id: "tutoring", label: "Tutoring" },
  { id: "activities", label: "Activities and clubs" },
  { id: "other", label: "Something else" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id as string, c.label]));

/** The label for a stored id, falling back to the id itself. A category that
 *  was valid when the row was written should not disappear from the screen
 *  because the list has since changed. */
export const categoryLabel = (id: string): string => BY_ID.get(id) ?? id;

export const isCategory = (id: string): boolean => BY_ID.has(id);

export type ProviderStatus = "pending" | "approved" | "hidden";

export const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  approved: "Live",
  hidden: "Hidden",
};

/**
 * What a visitor is allowed to put in, and how long each field may be.
 *
 * Trimmed and cut to length rather than rejected. A supplier who pastes a
 * 900-character description should get a listing with a shortened description,
 * not an error telling them to count characters — and the cap is what stops
 * the page being used as free hosting for something else.
 */
export const LIMITS = {
  name: 120,
  summary: 200,
  detail: 1200,
  areas: 200,
  contact_name: 80,
  phone: 40,
  email: 160,
  website: 200,
} as const;

export const clean = (v: FormDataEntryValue | null, max: number): string =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * A website as typed, made into something safe to put in an href.
 *
 * Anything that is not http or https is dropped rather than corrected — a
 * javascript: URL in a link on a public page is the one thing this field could
 * be used for, and there is no version of it worth keeping.
 */
export const safeUrl = (raw: string): string | null => {
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
