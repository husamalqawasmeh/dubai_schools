import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { audit } from "../../../lib/auth";
import { clearOverride, isOverridable, parseValue, setOverride } from "../../../lib/overrides";

const DB = (env as unknown as { DB: D1Database }).DB;

/**
 * One school, edited by an admin.
 *
 * Three kinds of change, each its own action rather than one catch-all save:
 * a correction to a field, taking a school off the site, and attaching a
 * photograph. They are separate because they carry different weight — a
 * delisting removes a school from every page, and should not ride along on a
 * form that also fixes a phone number.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const admin = locals.admin;
  if (!admin) return json({ ok: false, error: "Not signed in." }, 401);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Could not read that." }, 400);
  }

  const slug = String(body.slug ?? "");
  const school = await DB.prepare("SELECT id, name FROM schools WHERE slug = ?")
    .bind(slug)
    .first<{ id: number; name: string }>();
  if (!school) return json({ ok: false, error: "No school with that address." }, 404);

  switch (body.action) {
    /* ------------------------------------------------ correct one field -- */
    case "override": {
      const field = String(body.field ?? "");
      if (!isOverridable(field)) {
        return json({ ok: false, error: "That field cannot be corrected." }, 400);
      }
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 3) {
        // The column is NOT NULL by design: a correction without a reason is
        // indistinguishable from a typo six months later.
        return json({ ok: false, error: "Say why the source is wrong." }, 400);
      }
      const value = parseValue(field, String(body.value ?? ""));
      await setOverride(school.id, field, value, reason.slice(0, 400), admin.id);
      await audit(admin.id, "school_override", `${slug}.${field}`, ip);
      return json({ ok: true });
    }

    /* --------------------------------- drop it, and show the scrape again -- */
    case "clear": {
      const field = String(body.field ?? "");
      if (!isOverridable(field)) return json({ ok: false, error: "Unknown field." }, 400);
      await clearOverride(school.id, field);
      await audit(admin.id, "school_override_cleared", `${slug}.${field}`, ip);
      return json({ ok: true });
    }

    /* ------------------------------------------------------ hide or show -- */
    case "delist": {
      const hide = body.hide === true;
      await DB.prepare("UPDATE schools SET delisted_at = ? WHERE id = ?")
        .bind(hide ? new Date().toISOString() : null, school.id)
        .run();
      await audit(admin.id, hide ? "school_hidden" : "school_shown", slug, ip);
      return json({ ok: true });
    }

    /* ------------------------------------------------ the office email -- */
    // Not a correction: KHDA never published an office address, so there is no
    // scraped value for this to sit on top of. It belongs with the other
    // details we gathered ourselves.
    case "email": {
      const email = String(body.email ?? "").trim().slice(0, 200);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ ok: false, error: "That email address looks wrong." }, 400);
      }
      await DB.prepare(
        `INSERT INTO school_details (school_id, official_email, updated_by, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(school_id) DO UPDATE SET
           official_email = excluded.official_email,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`
      )
        .bind(school.id, email || null, admin.id, new Date().toISOString())
        .run();
      await audit(admin.id, "school_email", slug, ip);
      return json({ ok: true });
    }

    /* --------------------------------------------------- attach a picture -- */
    case "photo": {
      const url = String(body.url ?? "").trim();
      if (!/^https:\/\/\S+$/i.test(url)) {
        return json({ ok: false, error: "Give an https address for the image." }, 400);
      }
      // publish_ok stays 0: the table's own rule is that nothing reaches a
      // visitor until a review says so, and adding one here is not that review.
      await DB.prepare(
        `INSERT INTO school_photos (school_id, source, image_url, caption, publish_ok, review_state, created_at)
         VALUES (?, 'admin', ?, ?, 0, 'pending', ?)
         ON CONFLICT DO NOTHING`
      )
        .bind(school.id, url.slice(0, 600), String(body.caption ?? "").slice(0, 300) || null, new Date().toISOString())
        .run();
      await audit(admin.id, "school_photo_added", slug, ip);
      return json({ ok: true });
    }

    case "photo_delete": {
      const id = Number(body.photoId);
      if (!Number.isInteger(id)) return json({ ok: false, error: "Unknown photo." }, 400);
      await DB.prepare("DELETE FROM school_photos WHERE id = ? AND school_id = ?")
        .bind(id, school.id)
        .run();
      await audit(admin.id, "school_photo_removed", `${slug}#${id}`, ip);
      return json({ ok: true });
    }

    default:
      return json({ ok: false, error: "Unknown action." }, 400);
  }
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
