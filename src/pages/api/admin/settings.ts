import type { APIRoute } from "astro";
import { HIDE_PAID_TIERS, setFlag } from "../../../lib/settings";
import { audit } from "../../../lib/auth";

/** Site settings an admin can flip. Only keys named here can be written, so a
 *  request cannot invent one. */
const FLAGS: Record<string, string> = {
  hidePaidTiers: HIDE_PAID_TIERS,
};

export const POST: APIRoute = async ({ request, locals }) => {
  const admin = locals.admin;
  if (!admin) return json({ ok: false, error: "Not signed in." }, 401);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

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
