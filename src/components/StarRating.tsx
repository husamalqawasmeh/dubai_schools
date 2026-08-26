"use client";

import { useId, useState } from "react";
import { StarIcon } from "./icons";
import { cn } from "@/lib/cn";

const sizeClass = { sm: "size-3.5", md: "size-4", lg: "size-5" } as const;

/** Read-only rating. Half-steps are rounded — reviews are whole stars anyway. */
export function StarRating({
  value,
  size = "md",
  className,
}: {
  value: number;
  size?: keyof typeof sizeClass;
  className?: string;
}) {
  const rounded = Math.round(value);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            sizeClass[size],
            n <= rounded ? "text-accent-amber" : "text-ink-300"
          )}
        >
          <StarIcon filled={n <= rounded} />
        </span>
      ))}
    </span>
  );
}

/**
 * Interactive rating input. Implemented as a real radio group so it is
 * keyboard-operable and submits like the <select> it replaced.
 */
export function StarRatingInput({
  value,
  onChange,
  name = "rating",
  label = "Your rating",
}: {
  value: number;
  onChange: (value: number) => void;
  name?: string;
  label?: string;
}) {
  const id = useId();
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-700">
        {label}
      </legend>
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            htmlFor={`${id}-${n}`}
            onMouseEnter={() => setHovered(n)}
            className={cn(
              "cursor-pointer rounded-xs p-0.5 transition-transform duration-150 hover:scale-110",
              "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2",
              "focus-within:outline-brand-600"
            )}
          >
            <input
              id={`${id}-${n}`}
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <span className="sr-only">
              {n} star{n !== 1 ? "s" : ""}
            </span>
            <span
              className={cn(
                "block size-6 transition-colors duration-150",
                n <= shown ? "text-accent-amber" : "text-ink-300"
              )}
            >
              <StarIcon filled={n <= shown} />
            </span>
          </label>
        ))}
        <span className="ml-2 text-sm text-ink-500">
          {shown} of 5
        </span>
      </div>
    </fieldset>
  );
}

export default StarRating;
