/** AED figures render without decimals and with tabular numerals in the UI. */
export function formatAed(value: number): string {
  return value.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}

/**
 * KHDA does not publish a fee for every school, and publishes only an upper
 * bound for a few, so a range is not always available.
 */
export function formatFeeRange(min: number, max: number): string {
  if (max <= 0) return "Not published";
  if (min <= 0) return `Up to AED ${formatAed(max)}`;
  if (min === max) return `AED ${formatAed(min)}`;
  return `AED ${formatAed(min)}–${formatAed(max)}`;
}

/**
 * Relative for the last week, absolute after. Only ever called from client
 * components that read localStorage after mount, so there is no SSR mismatch.
 */
export function formatWhen(iso: string): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const day = 86_400_000;

  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) {
    const m = Math.floor(diffMs / 60_000);
    return `${m}m ago`;
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / 3_600_000);
    return `${h}h ago`;
  }
  if (diffMs < 7 * day) {
    const d = Math.floor(diffMs / day);
    return d === 1 ? "Yesterday" : `${d}d ago`;
  }
  return then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
