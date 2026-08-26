import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-ink-200 bg-white text-ink-900 shadow-xs " +
  "placeholder:text-ink-400 " +
  "transition-[border-color,box-shadow] duration-150 ease-out " +
  "hover:border-ink-300 " +
  "focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/12 " +
  "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400";

const sizing = "h-10 px-3 text-sm";

/** Label + control wrapper. Every input in the app goes through this so no
 *  field is left with a placeholder as its only label. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
  labelHidden = false,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  labelHidden?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className={cn(
          "text-[13px] font-medium text-ink-700",
          labelHidden && "sr-only"
        )}
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, sizing, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(control, "resize-y px-3 py-2.5 text-sm leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(control, sizing, "cursor-pointer appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-500"
      >
        <path
          d="M4 6.5 8 10.5 12 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
