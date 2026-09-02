import type { APIRoute } from "astro";
import { COOKIE, destroySession, clearCookieHeader } from "../../../lib/auth";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await destroySession(cookies.get(COOKIE)?.value);
  return new Response(null, {
    status: 302,
    headers: { Location: "/admin/login", "Set-Cookie": clearCookieHeader() },
  });
};
