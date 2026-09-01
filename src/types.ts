/**
 * Canonical vocabularies for school data.
 *
 * KHDA publishes curriculum as free text with dozens of spellings; the ingest
 * in scripts/seed-data/ maps those onto the lists below, which are the only
 * values that reach the UI. Keep the two in sync — the ingest imports from
 * this file so a mismatch is a type error rather than a silent bad filter.
 */

export const CURRICULA = [
  "British",
  "American",
  "IB",
  "Indian",
  "UAE MOE",
  "SABIS",
  "French",
  "German",
  "Japanese",
  "Russian",
  "Chinese",
  "Philippine",
  "Pakistani",
  "Australian",
  "Iranian",
  "Canadian",
  "Other",
] as const;

export type Curriculum = (typeof CURRICULA)[number];

/** KHDA's official six-tier inspection scale, best to worst. */
export const KHDA_RATINGS = [
  "Outstanding",
  "Very Good",
  "Good",
  "Acceptable",
  "Weak",
  "Very Weak",
] as const;

export type KhdaRating = (typeof KHDA_RATINGS)[number] | "Not rated";

/** Ordinal rank for sorting; unrated schools sort last. */
export const RATING_RANK: Record<string, number> = {
  ...Object.fromEntries(KHDA_RATINGS.map((r, i) => [r, i])),
  "Not rated": KHDA_RATINGS.length,
};

export interface School {
  slug: string;
  name: string;
  area: string;
  /** A school may run more than one curriculum (e.g. British and IB). */
  curricula: Curriculum[];
  khdaRating: KhdaRating;
  /** 0 when KHDA publishes no lower bound — render with formatFeeRange(). */
  feeMinAED: number;
  /** 0 when KHDA publishes no fee at all. */
  feeMaxAED: number;
  feeNote: string;
  gradeRange: string;
  website: string;
  address: string;
  description: string;
  /** KHDA's own identifier, stable across ingests. */
  khdaId: string;
  phone?: string;
}

export interface Review {
  id: string;
  schoolSlug: string;
  authorName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string; // ISO date
}

export type JournalCategory = "Review" | "Question" | "Quotation Request";

export interface JournalEntry {
  id: string;
  category: JournalCategory;
  authorName: string;
  schoolName?: string;
  title: string;
  message: string;
  createdAt: string; // ISO date
}
