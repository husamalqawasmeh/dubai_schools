import { cn } from "@/lib/cn";

export default function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-sm bg-ink-200", className)}
    />
  );
}

/** Placeholder for a list of localStorage-backed posts/reviews, shown for the
 *  one frame before client hydration reads them. */
export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="mt-4 h-4 w-1/2" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}
