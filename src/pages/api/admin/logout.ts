import type { APIRoute } from "astro";
import { COOKIE, destroySession, clearCookieHeader } from "../../../lib/auth";

/**
 * Signing out lands on the front page, not the login form.
 *
 * Returning someone to the login screen reads as "sign in again" — it offers
 * the thing they just chose to stop doing. The front page is where a signed-out
 * person actually belongs, and the way back in is one click from there.
 */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  await destroySession(cookies.get(COOKIE)?.value);
  return new Response(null, {
    status: 302,
    headers: { Location: "/", "Set-Cookie": clearCookieHeader() },
  });
};
