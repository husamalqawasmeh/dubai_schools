import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "amber" | "blue" | "violet";

const dotTone: Record<Tone, string> = {
  neutral: "bg-ink-400",
  brand: "bg-brand-600",
  amber: "bg-accent-amber",
  blue: "bg-accent-blue",
  violet: "bg-accent-violet",
};

/**
 * One chip style for the whole app: neutral surface + a small coloured dot.
 * Categorical colour stays in the 6px dot, so a grid of cards reads as one
 * system instead of a bag of tinted pills.
 */
export default function Badge({
  children,
  tone = "neutral",
  dot = true,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-ink-200 bg-white",
        "px-2 py-[3px] text-xs font-medium text-ink-700",
        className
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", dotTone[tone])}
        />
      )}
      {children}
    </span>
  );
}

/** KHDA's six tiers, mapped to dot colours that descend with the rating. */
export const khdaTone: Record<string, Tone> = {
  Outstanding: "brand",
  "Very Good": "blue",
  Good: "amber",
  Acceptable: "violet",
  Weak: "neutral",
  "Very Weak": "neutral",
  "Not rated": "neutral",
};
