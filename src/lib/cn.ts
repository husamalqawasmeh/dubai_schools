/** Minimal class-name joiner — no runtime dependency needed for our use. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
