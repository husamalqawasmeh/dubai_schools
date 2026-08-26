"use client";

import { useEffect, useMemo, useState } from "react";
import { JournalCategory } from "@/types";
import { addJournalEntry } from "@/lib/storage";
import { useHydrated, useJournalEntries } from "@/lib/useStore";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import EmptyState from "./ui/EmptyState";
import { Field, Input, Select, Textarea } from "./ui/Field";
import { CardSkeleton } from "./ui/Skeleton";
import { CheckIcon, InboxIcon, SearchIcon } from "./icons";
import { formatWhen, initials } from "@/lib/format";
import { cn } from "@/lib/cn";

const CATEGORIES: JournalCategory[] = ["Review", "Question", "Quotation Request"];

const categoryTone = {
  Review: "brand",
  Question: "blue",
  "Quotation Request": "violet",
} as const;

export default function JournalBoard() {
  const entries = useJournalEntries();
  const loaded = useHydrated();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | JournalCategory>("All");

  const [category, setCategory] = useState<JournalCategory>("Review");
  const [authorName, setAuthorName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [justPosted, setJustPosted] = useState(false);

  useEffect(() => {
    if (!justPosted) return;
    const t = setTimeout(() => setJustPosted(false), 4000);
    return () => clearTimeout(t);
  }, [justPosted]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !title.trim() || !message.trim()) return;
    addJournalEntry({
      category,
      authorName: authorName.trim(),
      schoolName: schoolName.trim() || undefined,
      title: title.trim(),
      message: message.trim(),
    });
    setAuthorName("");
    setSchoolName("");
    setTitle("");
    setMessage("");
    setCategory("Review");
    setJustPosted(true);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesCategory = categoryFilter === "All" || e.category === categoryFilter;
      const matchesQuery =
        q === "" ||
        [e.title, e.message, e.authorName, e.schoolName ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [entries, query, categoryFilter]);

  const tabs: ("All" | JournalCategory)[] = ["All", ...CATEGORIES];
  const canSubmit =
    authorName.trim().length > 0 && title.trim().length > 0 && message.trim().length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
      <div className="lg:order-1 lg:col-span-2">
        <Card className="p-4">
          <Field label="Search the journal" htmlFor="journal-search" labelHidden>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400">
                <SearchIcon />
              </span>
              <Input
                id="journal-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by school, topic, or area…"
                className="h-11 pl-11 text-[15px]"
              />
            </div>
          </Field>

          <div
            role="group"
            aria-label="Filter posts by type"
            className="mt-3 flex flex-wrap gap-1 rounded-md bg-ink-100 p-1"
          >
            {tabs.map((tab) => {
              const active = categoryFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoryFilter(tab)}
                  className={cn(
                    "flex-1 rounded-sm px-3 py-1.5 text-[13px] font-medium",
                    "transition-[background-color,color,box-shadow] duration-150",
                    active
                      ? "bg-white text-ink-900 shadow-xs"
                      : "text-ink-500 hover:text-ink-900"
                  )}
                >
                  {tab === "All" ? "All posts" : tab}
                </button>
              );
            })}
          </div>
        </Card>

        <p aria-live="polite" className="mt-5 text-sm text-ink-500">
          <span className="font-semibold text-ink-900">{filtered.length}</span>{" "}
          post{filtered.length !== 1 ? "s" : ""}
        </p>

        <div className="mt-3 space-y-3">
          {!loaded && (
            <>
              <CardSkeleton lines={2} />
              <CardSkeleton lines={3} />
            </>
          )}

          {loaded && filtered.length === 0 && (
            <EmptyState
              icon={
                <span className="size-5">
                  <InboxIcon />
                </span>
              }
              title={
                entries.length === 0
                  ? "The journal is empty"
                  : "No posts match your search"
              }
              description={
                entries.length === 0
                  ? "Start the board off with a question, a review, or a request for fee quotations."
                  : "Try a different keyword, or switch back to all post types."
              }
            />
          )}

          {loaded &&
            filtered.map((entry) => (
              <Card key={entry.id} as="article" className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={categoryTone[entry.category]}>{entry.category}</Badge>
                  <span className="text-xs text-ink-500">
                    {formatWhen(entry.createdAt)}
                  </span>
                </div>

                <h3 className="mt-3 text-[15px] font-semibold leading-snug text-ink-900">
                  {entry.title}
                </h3>
                {entry.schoolName && (
                  <p className="mt-1 text-[13px] text-ink-500">
                    Re: {entry.schoolName}
                  </p>
                )}

                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">
                  {entry.message}
                </p>

                <div className="mt-4 flex items-center gap-2.5 border-t border-ink-200/80 pt-4">
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-600"
                  >
                    {initials(entry.authorName)}
                  </span>
                  <span className="text-[13px] font-medium text-ink-700">
                    {entry.authorName}
                  </span>
                </div>
              </Card>
            ))}
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="lg:order-2 lg:sticky lg:top-24 lg:self-start"
      >
        <Card className="space-y-5 p-5">
          <div>
            <h2 className="text-base font-semibold text-ink-900">New post</h2>
            <p className="mt-1 text-sm text-ink-500">
              Shared with everyone using this browser.
            </p>
          </div>

          <Field label="Post type" htmlFor="journal-category">
            <Select
              id="journal-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as JournalCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Your name" htmlFor="journal-author">
            <Input
              id="journal-author"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="e.g. Ahmed K."
              required
              autoComplete="name"
            />
          </Field>

          <Field
            label="School name"
            htmlFor="journal-school"
            hint="Optional — leave blank for a general post."
          >
            <Input
              id="journal-school"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Dubai College"
            />
          </Field>

          <Field label="Title" htmlFor="journal-title">
            <Input
              id="journal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of your post"
              required
            />
          </Field>

          <Field label="Message" htmlFor="journal-message">
            <Textarea
              id="journal-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                category === "Quotation Request"
                  ? "Which grade, curriculum, and area are you looking at?"
                  : "Write your message…"
              }
              required
              rows={4}
            />
          </Field>

          <div className="space-y-3">
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              Post to journal
            </Button>
            {justPosted && (
              <p
                role="status"
                className="animate-fade-in inline-flex items-center gap-1.5 text-sm font-medium text-brand-700"
              >
                <span className="size-4">
                  <CheckIcon />
                </span>
                Posted to the journal
              </p>
            )}
          </div>
        </Card>
      </form>
    </div>
  );
}
