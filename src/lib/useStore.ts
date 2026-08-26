"use client";

import { useMemo, useSyncExternalStore } from "react";
import { JournalEntry, Review } from "@/types";
import {
  getEmptySnapshot,
  getJournalSnapshot,
  getReviewsSnapshot,
  subscribeStorage,
} from "./storage";

const noopSubscribe = () => () => {};

/** False during SSR and the hydration pass, true afterwards — lets lists show
 *  a skeleton for the frame before localStorage has been read. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function useReviews(schoolSlug: string): Review[] {
  const all = useSyncExternalStore(
    subscribeStorage,
    getReviewsSnapshot,
    getEmptySnapshot<Review>
  );
  return useMemo(
    () => all.filter((r) => r.schoolSlug === schoolSlug),
    [all, schoolSlug]
  );
}

export function useJournalEntries(): JournalEntry[] {
  return useSyncExternalStore(
    subscribeStorage,
    getJournalSnapshot,
    getEmptySnapshot<JournalEntry>
  );
}
