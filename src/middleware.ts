import { defineMiddleware } from "astro:middleware";
import { COOKIE, userFromSession } from "./lib/auth";

/**
 * Everything under /admin needs a session, except the login page and the
 * endpoint that creates one. Enforced here rather than page by page, so a new
 * admin page is protected by existing rather than by remembering to add a
 * guard to it.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  if (!path.startsWith("/admin") && !path.startsWith("/api/admin")) return next();

  const open = path === "/admin/login" || path === "/api/admin/login";
  const user = await userFromSession(context.cookies.get(COOKIE)?.value);
  context.locals.admin = user ?? undefined;

  if (open) {
    // Already signed in? Skip the login form.
    if (user && path === "/admin/login") return context.redirect("/admin", 302);
    return next();
  }

  if (!user) {
    if (path.startsWith("/api/")) {
      return new Response(JSON.stringify({ ok: false, error: "Not signed in." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return context.redirect("/admin/login", 302);
  }

  return next();
});
