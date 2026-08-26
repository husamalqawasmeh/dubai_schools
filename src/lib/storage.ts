import { JournalEntry, Review } from "@/types";

const REVIEWS_KEY = "dxb-schools-reviews";
const JOURNAL_KEY = "dxb-schools-journal";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

/* ---------------------------------------------------------------------------
   Snapshot store
   localStorage is an external store, so components read it through
   useSyncExternalStore rather than a setState-in-effect. Snapshots are cached
   so the reference stays stable between renders (required by the hook) and
   only changes when we actually write.
--------------------------------------------------------------------------- */

const EMPTY: readonly never[] = [];
const listeners = new Set<() => void>();

let reviewsCache: Review[] | null = null;
let journalCache: JournalEntry[] | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeStorage(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getReviewsSnapshot(): Review[] {
  reviewsCache ??= read<Review>(REVIEWS_KEY);
  return reviewsCache;
}

export function getJournalSnapshot(): JournalEntry[] {
  journalCache ??= read<JournalEntry>(JOURNAL_KEY);
  return journalCache;
}

/** Stable empty snapshot used during SSR and hydration. */
export function getEmptySnapshot<T>(): T[] {
  return EMPTY as unknown as T[];
}

/* --------------------------------------------------------------------------- */

export function getReviews(schoolSlug?: string): Review[] {
  const all = getReviewsSnapshot();
  return schoolSlug ? all.filter((r) => r.schoolSlug === schoolSlug) : all;
}

export function addReview(review: Omit<Review, "id" | "createdAt">): Review {
  const newReview: Review = {
    ...review,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = [newReview, ...getReviewsSnapshot()];
  reviewsCache = all;
  write(REVIEWS_KEY, all);
  emit();
  return newReview;
}

export function getJournalEntries(): JournalEntry[] {
  return getJournalSnapshot();
}

export function addJournalEntry(
  entry: Omit<JournalEntry, "id" | "createdAt">
): JournalEntry {
  const newEntry: JournalEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = [newEntry, ...getJournalSnapshot()];
  journalCache = all;
  write(JOURNAL_KEY, all);
  emit();
  return newEntry;
}
