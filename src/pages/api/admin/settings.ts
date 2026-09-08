import type { APIRoute } from "astro";
import { HIDE_PAID_TIERS, HIDE_SUPPLIES, setFlag } from "../../../lib/settings";
import { audit } from "../../../lib/auth";

/** Site settings an admin can flip. Only keys named here can be written, so a
 *  request cannot invent one. */
const FLAGS: Record<string, string> = {
  hidePaidTiers: HIDE_PAID_TIERS,
  hideSupplies: HIDE_SUPPLIES,
};

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = locals.admin;
  if (!admin) return json({ ok: false, error: "Not signed in." }, 401);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  /* Two callers, two shapes. The settings screen sends JSON from a script;
     the toggles on the admin menu are plain form posts, so they keep working
     with JavaScript off and can redirect back to the page they came from —
     which a fetch cannot do. Same allow-list either way. */
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("form")) {
    const form = await request.formData();
    const key = FLAGS[String(form.get("flag") ?? "")];
    const to = String(form.get("on") ?? "") === "1";
    const back = String(form.get("back") ?? "/admin/admin");
    if (key) {
      await setFlag(key, to, admin.id);
      await audit(admin.id, "settings_changed", `${form.get("flag")}=${to ? "on" : "off"}`, ip);
    }
    // Back to a path on this site, never to whatever the form asked for.
    const safe = back.startsWith("/") && !back.startsWith("//") ? back : "/admin/admin";
    return new Response(null, { status: 303, headers: { Location: safe } });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Could not read that." }, 400);
  }

  const changed: string[] = [];
  for (const [name, key] of Object.entries(FLAGS)) {
    if (typeof body[name] !== "boolean") continue;
    await setFlag(key, body[name] as boolean, admin.id);
    changed.push(`${name}=${body[name] ? "on" : "off"}`);
  }

  if (!changed.length) return json({ ok: false, error: "Nothing to change." }, 400);

  await audit(admin.id, "settings_changed", changed.join(","), ip);
  return json({ ok: true });
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
