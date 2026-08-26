import { cn } from "@/lib/cn";

/**
 * Surface primitive. `interactive` adds the lift used by links/cards in grids —
 * a border shift plus a small shadow, never a scale transform.
 */
export default function Card({
  children,
  className,
  interactive = false,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  as?: "div" | "article" | "li" | "section";
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg border border-ink-200 bg-white shadow-xs",
        interactive &&
          "transition-[border-color,box-shadow,transform] duration-200 ease-out " +
            "hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-md",
        className
      )}
    >
      {children}
    </Tag>
  );
}
