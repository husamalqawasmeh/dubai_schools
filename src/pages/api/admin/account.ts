import type { APIRoute } from "astro";
import { COOKIE, updateAccount } from "../../../lib/auth";

/**
 * An admin changing their own email address or password.
 *
 * Only ever acts on the signed-in account: the id comes from the session the
 * middleware resolved, never from the request body, so this cannot be pointed
 * at somebody else's row.
 */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const admin = locals.admin;
  if (!admin) return json({ ok: false, error: "Not signed in." }, 401);

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";

  let body: { currentPassword?: string; email?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Could not read that." }, 400);
  }

  const currentPassword = (body.currentPassword ?? "").slice(0, 400);
  if (!currentPassword) {
    return json({ ok: false, error: "Enter your current password." }, 400);
  }

  const result = await updateAccount(
    admin.id,
    currentPassword,
    {
      email: body.email?.slice(0, 200),
      newPassword: body.newPassword?.slice(0, 400),
    },
    cookies.get(COOKIE)?.value,
    ip
  );

  return json(result, result.ok ? 200 : 400);
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
