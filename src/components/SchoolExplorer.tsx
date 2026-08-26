"use client";

import { useMemo, useState } from "react";
import {
  KHDA_RATINGS,
  RATING_RANK,
  type Curriculum,
  type KhdaRating,
  type School,
} from "@/types";
import SchoolCard from "./SchoolCard";
import Button from "./ui/Button";
import Card from "./ui/Card";
import EmptyState from "./ui/EmptyState";
import { Field, Input, Select } from "./ui/Field";
import { CloseIcon, SearchIcon, SlidersIcon } from "./icons";
import { formatAed } from "@/lib/format";
import { cn } from "@/lib/cn";

// Bounds chosen from the real KHDA range across all 232 schools.
const FEE_CEILING = 150_000;
const FEE_FLOOR = 2_000;
const FEE_STEP = 2_000;

type SortKey = "rating" | "name" | "fee-asc" | "fee-desc";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "rating", label: "KHDA rating" },
  { value: "name", label: "Name (A–Z)" },
  { value: "fee-asc", label: "Fee: low to high" },
  { value: "fee-desc", label: "Fee: high to low" },
];

export default function SchoolExplorer({ schools }: { schools: School[] }) {
  const [query, setQuery] = useState("");
  const [curriculum, setCurriculum] = useState<Curriculum | "All">("All");
  const [area, setArea] = useState("All");
  const [rating, setRating] = useState<KhdaRating | "All">("All");
  const [maxFee, setMaxFee] = useState(FEE_CEILING);
  const [sort, setSort] = useState<SortKey>("rating");

  const curricula = useMemo(
    () => [
      "All" as const,
      ...Array.from(new Set(schools.flatMap((s) => s.curricula))).sort(),
    ],
    [schools]
  );
  const areas = useMemo(
    () => ["All", ...Array.from(new Set(schools.map((s) => s.area))).sort()],
    [schools]
  );
  // Show KHDA's tiers in their official order, but only those actually present.
  const ratings = useMemo(() => {
    const present = new Set<KhdaRating>(schools.map((s) => s.khdaRating));
    const ordered: KhdaRating[] = [...KHDA_RATINGS, "Not rated"];
    return ["All" as const, ...ordered.filter((r) => present.has(r))];
  }, [schools]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = schools.filter((s) => {
      const matchesQuery =
        q === "" ||
        [s.name, s.area, s.curricula.join(" "), s.description]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesCurriculum =
        curriculum === "All" || s.curricula.includes(curriculum);
      const matchesArea = area === "All" || s.area === area;
      const matchesRating = rating === "All" || s.khdaRating === rating;
      // Once a budget is set, a school with no published fee cannot be
      // confirmed to fit it, so it drops out rather than being assumed cheap.
      const matchesFee =
        maxFee >= FEE_CEILING || (s.feeMinAED > 0 && s.feeMinAED <= maxFee);
      return (
        matchesQuery && matchesCurriculum && matchesArea && matchesRating && matchesFee
      );
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "fee-asc":
          // Unpriced schools sort last rather than to the top as zero.
          return (a.feeMinAED || Infinity) - (b.feeMinAED || Infinity);
        case "fee-desc":
          return b.feeMaxAED - a.feeMaxAED;
        default:
          return (
            (RATING_RANK[a.khdaRating] ?? 9) - (RATING_RANK[b.khdaRating] ?? 9) ||
            a.name.localeCompare(b.name)
          );
      }
    });
  }, [schools, query, curriculum, area, rating, maxFee, sort]);

  const activeFilters = [
    query.trim() && { label: `"${query.trim()}"`, clear: () => setQuery("") },
    curriculum !== "All" && { label: curriculum, clear: () => setCurriculum("All") },
    area !== "All" && { label: area, clear: () => setArea("All") },
    rating !== "All" && { label: rating, clear: () => setRating("All") },
    maxFee < FEE_CEILING && {
      label: `Up to AED ${formatAed(maxFee)}`,
      clear: () => setMaxFee(FEE_CEILING),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  function clearAll() {
    setQuery("");
    setCurriculum("All");
    setArea("All");
    setRating("All");
    setMaxFee(FEE_CEILING);
  }

  return (
    <div>
      <Card className="p-4 sm:p-5">
        <Field label="Search schools" htmlFor="school-search" labelHidden>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-400">
              <SearchIcon />
            </span>
            <Input
              id="school-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by school, area, or curriculum…"
              className="h-11 pl-11 text-[15px]"
            />
          </div>
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="Curriculum" htmlFor="filter-curriculum">
            <Select
              id="filter-curriculum"
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value as Curriculum | "All")}
            >
              {curricula.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All curricula" : c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Area" htmlFor="filter-area">
            <Select
              id="filter-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a === "All" ? "All areas" : a}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="KHDA rating" htmlFor="filter-rating">
            <Select
              id="filter-rating"
              value={rating}
              onChange={(e) => setRating(e.target.value as KhdaRating | "All")}
            >
              {ratings.map((r) => (
                <option key={r} value={r}>
                  {r === "All" ? "All ratings" : r}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Sort by" htmlFor="filter-sort">
            <Select
              id="filter-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-ink-200 pt-4 sm:flex-row sm:items-center sm:gap-5">
          <label
            htmlFor="filter-fee"
            className="flex shrink-0 items-baseline gap-2 text-[13px] font-medium text-ink-700"
          >
            Max annual fee
            <span className="tabular text-sm font-semibold text-ink-900">
              {maxFee >= FEE_CEILING ? "Any" : `AED ${formatAed(maxFee)}`}
            </span>
          </label>
          <input
            id="filter-fee"
            type="range"
            min={FEE_FLOOR}
            max={FEE_CEILING}
            step={FEE_STEP}
            value={maxFee}
            onChange={(e) => setMaxFee(Number(e.target.value))}
            className="h-5 w-full cursor-pointer accent-brand-700 sm:flex-1"
          />
        </div>
      </Card>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <p aria-live="polite" className="text-sm text-ink-500">
          <span className="font-semibold text-ink-900">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "school" : "schools"}
          {activeFilters.length > 0 && (
            <span className="text-ink-400"> of {schools.length}</span>
          )}
        </p>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={f.clear}
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-sm border border-ink-200",
                  "bg-white py-1 pl-2.5 pr-1.5 text-xs font-medium text-ink-700 shadow-xs",
                  "transition-colors duration-150 hover:border-ink-300 hover:bg-ink-50"
                )}
              >
                <span className="max-w-[14rem] truncate">{f.label}</span>
                <span className="size-3.5 text-ink-400 transition-colors group-hover:text-ink-700">
                  <CloseIcon />
                </span>
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="rounded-sm px-1.5 py-1 text-xs font-medium text-brand-700 underline-offset-2 transition-colors hover:text-brand-800 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((school) => (
            <SchoolCard key={school.slug} school={school} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-4"
          icon={
            <span className="size-5">
              <SlidersIcon />
            </span>
          }
          title="No schools match these filters"
          description="Try widening your budget, clearing the area filter, or searching for a different curriculum."
          action={
            <Button variant="secondary" onClick={clearAll}>
              Clear all filters
            </Button>
          }
        />
      )}
    </div>
  );
}
