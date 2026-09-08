import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { CATEGORIES, LIMITS, clean, isCategory, safeUrl } from "../../../lib/providers";

/**
 * A supplier registering itself.
 *
 * Public and unauthenticated, which is the point — the businesses this is for
 * have no account here and should not need one to ask to be listed. Everything
 * it writes lands as `pending` and nothing reaches the page until an admin
 * approves it, so the worst an abusive submission achieves is a row in a queue.
 *
 * A plain form post rather than JSON: it works with JavaScript off, and it can
 * redirect back to the page it came from, which a fetch cannot.
 */
const DB = (env as unknown as { DB: D1Database }).DB;

const back = (q: string) =>
  new Response(null, { status: 303, headers: { Location: `/suppliers${q}` } });

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  const name = clean(form.get("name"), LIMITS.name);
  const summary = clean(form.get("summary"), LIMITS.summary);
  const category = String(form.get("category") ?? "");

  // The three that make a listing mean anything. Everything else is optional,
  // because a supplier with only a phone number is still worth listing and
  // demanding a website would quietly exclude the smallest of them.
  if (!name || !summary || !isCategory(category)) return back("?err=1#register");

  // One contact route at minimum, or the listing is a name nobody can act on.
  const phone = clean(form.get("phone"), LIMITS.phone);
  const email = clean(form.get("email"), LIMITS.email);
  const website = safeUrl(clean(form.get("website"), LIMITS.website));
  if (!phone && !email && !website) return back("?err=2#register");

  /* Rate limit by address: five in an hour is far more than a real supplier
     needs and far less than a script wants. Counted rather than enforced with
     a separate store, because the rows are already here. */
  const recent = await DB.prepare(
    "SELECT COUNT(*) n FROM providers WHERE submitted_ip = ? AND created_at > ?"
  )
    .bind(ip, new Date(Date.now() - 3600_000).toISOString())
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return back("?err=3#register");

  const now = new Date().toISOString();
  await DB.prepare(
    `INSERT INTO providers
       (name, category, summary, detail, areas, contact_name, phone, email,
        website, status, submitted_ip, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?)`
  )
    .bind(
      name,
      category,
      summary,
      clean(form.get("detail"), LIMITS.detail) || null,
      clean(form.get("areas"), LIMITS.areas) || null,
      clean(form.get("contact_name"), LIMITS.contact_name) || null,
      phone || null,
      email || null,
      website,
      ip,
      now,
      now
    )
    .run();

  return back("?sent=1#register");
};

export const prerender = false;

/** Exported so the form and the validator cannot disagree about the list. */
export const _CATEGORIES = CATEGORIES;
