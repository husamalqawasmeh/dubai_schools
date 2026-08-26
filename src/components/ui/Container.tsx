import { cn } from "@/lib/cn";

/**
 * The one place page width and gutters are defined. `width="narrow"` is for
 * reading-heavy pages (school detail), `default` for index/grid pages.
 */
export default function Container({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "narrow" | "wide";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-6 lg:px-8",
        width === "narrow" && "max-w-4xl",
        width === "default" && "max-w-6xl",
        width === "wide" && "max-w-7xl",
        className
      )}
    >
      {children}
    </div>
  );
}
