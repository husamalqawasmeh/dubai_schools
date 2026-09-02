import type { APIRoute } from "astro";
import { attemptLogin, createSession, cookieHeader, audit } from "../../../lib/auth";

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Could not read that." }, 400);
  }

  const email = (body.email ?? "").trim().slice(0, 200);
  const password = (body.password ?? "").slice(0, 400);
  if (!email || !password) return json({ ok: false, error: "Enter an email and password." }, 400);

  const { user, error } = await attemptLogin(email, password);
  if (!user) {
    await audit(null, "login_failed", email, ip);
    return json({ ok: false, error }, 401);
  }

  const token = await createSession(user.id, ip, request.headers.get("User-Agent") ?? "");
  await audit(user.id, "login", user.email, ip);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": cookieHeader(token),
    },
  });
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
