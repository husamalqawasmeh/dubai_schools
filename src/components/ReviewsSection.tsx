"use client";

import { useEffect, useRef, useState } from "react";
import { addReview } from "@/lib/storage";
import { useHydrated, useReviews } from "@/lib/useStore";
import { StarRating, StarRatingInput } from "./StarRating";
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";
import { Field, Input, Textarea } from "./ui/Field";
import { CardSkeleton } from "./ui/Skeleton";
import { CheckIcon, InboxIcon } from "./icons";
import { formatWhen, initials } from "@/lib/format";

export default function ReviewsSection({ schoolSlug }: { schoolSlug: string }) {
  const reviews = useReviews(schoolSlug);
  const loaded = useHydrated();
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [justPosted, setJustPosted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the confirmation after a beat so it does not linger on the page.
  useEffect(() => {
    if (!justPosted) return;
    const t = setTimeout(() => setJustPosted(false), 4000);
    return () => clearTimeout(t);
  }, [justPosted]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) return;
    addReview({ schoolSlug, authorName: name.trim(), rating, comment: comment.trim() });
    setName("");
    setComment("");
    setRating(5);
    setJustPosted(true);
  }

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const canSubmit = name.trim().length > 0 && comment.trim().length > 0;

  return (
    <section aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="reviews-heading"
            className="text-xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-2xl"
          >
            Parent reviews
          </h2>
          <p className="mt-1.5 text-sm text-ink-500">
            Posted by visitors to this site and stored in your browser.
          </p>
        </div>

        {loaded && reviews.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-2.5 shadow-xs">
            <span className="tabular text-2xl font-semibold leading-none text-ink-900">
              {average.toFixed(1)}
            </span>
            <div>
              <StarRating value={average} size="sm" />
              <p className="mt-1 text-xs text-ink-500">
                {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {!loaded && <CardSkeleton lines={2} />}

        {loaded && reviews.length === 0 && (
          <EmptyState
            icon={
              <span className="size-5">
                <InboxIcon />
              </span>
            }
            title="No reviews yet"
            description="Be the first to share what this school is actually like day to day."
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  formRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              >
                Write a review
              </Button>
            }
          />
        )}

        {loaded &&
          reviews.map((r) => (
            <Card key={r.id} as="article" className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-800"
                  >
                    {initials(r.authorName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {r.authorName}
                    </p>
                    <p className="text-xs text-ink-500">{formatWhen(r.createdAt)}</p>
                  </div>
                </div>
                <StarRating value={r.rating} size="sm" className="shrink-0 pt-1" />
              </div>
              <p className="mt-3.5 whitespace-pre-line text-sm leading-relaxed text-ink-700">
                {r.comment}
              </p>
            </Card>
          ))}
      </div>

      <Card className="mt-8 p-5 sm:p-6">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h3 className="text-base font-semibold text-ink-900">
              Leave a review
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              Keep it factual and about your own experience.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
            <Field label="Your name" htmlFor="review-name">
              <Input
                id="review-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sara M."
                required
                autoComplete="name"
              />
            </Field>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          <Field label="Your review" htmlFor="review-comment">
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What stood out — teaching, communication, facilities, the commute?"
              required
              rows={4}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!canSubmit}>
              Submit review
            </Button>
            {justPosted && (
              <p
                role="status"
                className="animate-fade-in inline-flex items-center gap-1.5 text-sm font-medium text-brand-700"
              >
                <span className="size-4">
                  <CheckIcon />
                </span>
                Review posted
              </p>
            )}
          </div>
        </form>
      </Card>
    </section>
  );
}
