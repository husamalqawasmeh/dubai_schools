import { env } from "cloudflare:workers";

const DB = (env as unknown as { DB: D1Database }).DB;

/**
 * PBKDF2-HMAC-SHA256 through WebCrypto.
 *
 * Not bcrypt or Argon2: Workers has no native binding for either, and a
 * pure-JavaScript Argon2id is memory-hard by design and fights the CPU limit.
 * PBKDF2 through crypto.subtle runs natively, which is what makes a high
 * iteration count affordable here.
 *
 * Workers caps PBKDF2 at 100,000 iterations — above that crypto.subtle throws
 * NotSupportedError — which is well under what OWASP asks of PBKDF2-SHA256.
 * The work factor is recovered by chaining rounds: each round feeds the last
 * round's output back in as the password, so N rounds cost N x 100,000.
 *
 * The stored form carries both numbers, so the cost can be raised later
 * without invalidating rows already written.
 */
const ITERATIONS = 100_000;   // the Workers ceiling
const ROUNDS = 3;             // 300,000 effective

const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(
  password: BufferSource | string,
  salt: Uint8Array,
  iterations: number,
  rounds = 1
): Promise<ArrayBuffer> {
  let material: BufferSource =
    typeof password === "string" ? new TextEncoder().encode(password) : password;
  let out: ArrayBuffer = new ArrayBuffer(0);
  for (let i = 0; i < rounds; i++) {
    const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
    out = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
      key,
      256
    );
    material = out;
  }
  return out;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, ITERATIONS, ROUNDS);
  return `pbkdf2r${ROUNDS}$${ITERATIONS}$${b64(salt.buffer)}$${b64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iters, salt, hash] = stored.split("$");
  const m = scheme.match(/^pbkdf2r(\d+)$/);
  if (!m) return false;
  const bits = await pbkdf2(password, unb64(salt), Number(iters), Number(m[1]));
  // Constant-time: compare every byte regardless of where they diverge.
  const a = new Uint8Array(bits);
  const b = unb64(hash);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* -------------------------------------------------------------------------- */
/* sessions                                                                    */
/* -------------------------------------------------------------------------- */

export const COOKIE = "dxb_admin";
const IDLE_HOURS = 8;

/** Only the hash is stored, so a leaked database read hands over no live
 *  sessions. */
async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export interface AdminUser {
  id: number;
  email: string;
  role: string;
}

export async function createSession(userId: number, ip: string, ua: string): Promise<string> {
  const token = b64(crypto.getRandomValues(new Uint8Array(32)).buffer)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const now = Date.now();
  await DB.prepare(
    `INSERT INTO admin_sessions (token_hash, user_id, created_at, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      await sha256(token),
      userId,
      new Date(now).toISOString(),
      new Date(now + IDLE_HOURS * 3600_000).toISOString(),
      ip.slice(0, 60),
      ua.slice(0, 300)
    )
    .run();
  return token;
}

export async function userFromSession(token: string | undefined): Promise<AdminUser | null> {
  if (!token) return null;
  const row = await DB.prepare(
    `SELECT u.id, u.email, u.role
     FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(await sha256(token), new Date().toISOString())
    .first<AdminUser>();
  return row ?? null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
    .bind(await sha256(token))
    .run();
}

export function cookieHeader(token: string, maxAgeSeconds = IDLE_HOURS * 3600): string {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}
export const clearCookieHeader = () =>
  `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

/* -------------------------------------------------------------------------- */
/* login attempts                                                              */
/* -------------------------------------------------------------------------- */

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export interface LoginResult {
  user: AdminUser | null;
  error: string | null;
}

/** One message for every failure. Saying "no such account" tells an attacker
 *  which addresses are worth attacking. */
const GENERIC = "That email and password do not match.";

export async function attemptLogin(email: string, password: string): Promise<LoginResult> {
  const row = await DB.prepare(
    `SELECT id, email, role, password_hash, failed_count, locked_until
     FROM admin_users WHERE email = ?`
  )
    .bind(email.trim().toLowerCase())
    .first<any>();

  if (!row) {
    // Burn comparable time so a missing account is not faster than a wrong
    // password, which would leak which addresses exist.
    await pbkdf2(password, new Uint8Array(16), ITERATIONS, ROUNDS);
    return { user: null, error: GENERIC };
  }

  if (row.locked_until && row.locked_until > new Date().toISOString()) {
    return { user: null, error: "Too many attempts. Try again in a few minutes." };
  }

  if (!(await verifyPassword(password, row.password_hash))) {
    const fails = (row.failed_count ?? 0) + 1;
    const lockUntil =
      fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
    await DB.prepare("UPDATE admin_users SET failed_count = ?, locked_until = ? WHERE id = ?")
      .bind(fails >= MAX_FAILS ? 0 : fails, lockUntil, row.id)
      .run();
    return { user: null, error: GENERIC };
  }

  await DB.prepare(
    "UPDATE admin_users SET failed_count = 0, locked_until = NULL, last_login_at = ? WHERE id = ?"
  )
    .bind(new Date().toISOString(), row.id)
    .run();

  return { user: { id: row.id, email: row.email, role: row.role }, error: null };
}

export async function audit(
  userId: number | null,
  action: string,
  detail: string,
  ip: string
): Promise<void> {
  await DB.prepare(
    "INSERT INTO audit_log (at, user_id, action, detail, ip) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(new Date().toISOString(), userId, action, detail.slice(0, 500), ip.slice(0, 60))
    .run();
}

/* -------------------------------------------------------------------------- */
/* account maintenance                                                         */
/* -------------------------------------------------------------------------- */

/** Longer than the floor the seeding script accepts. A password chosen at a
 *  keyboard is guessed more easily than one a generator produced, so the one
 *  people pick themselves is held to more. */
export const MIN_PASSWORD = 10;

export interface AccountUpdate {
  email?: string;
  newPassword?: string;
}

export type AccountResult = { ok: true; email: string } | { ok: false; error: string };

/** Ends every session for this user except the one asking, so a password
 *  change logs out anyone else holding a cookie without bouncing the person
 *  making the change back to the login form. */
export async function destroyOtherSessions(
  userId: number,
  keepToken: string | undefined
): Promise<void> {
  const keep = keepToken ? await sha256(keepToken) : "";
  await DB.prepare("DELETE FROM admin_sessions WHERE user_id = ? AND token_hash <> ?")
    .bind(userId, keep)
    .run();
}

/**
 * Changes an admin's own email address, password, or both.
 *
 * Both take the current password. A session cookie alone is not enough: if one
 * is ever borrowed, it should not be able to lock the owner out of the account
 * by changing what they sign in with.
 */
export async function updateAccount(
  userId: number,
  currentPassword: string,
  update: AccountUpdate,
  currentToken: string | undefined,
  ip: string
): Promise<AccountResult> {
  const row = await DB.prepare("SELECT id, email, password_hash FROM admin_users WHERE id = ?")
    .bind(userId)
    .first<{ id: number; email: string; password_hash: string }>();
  if (!row) return { ok: false, error: "That account no longer exists." };

  if (!(await verifyPassword(currentPassword, row.password_hash))) {
    await audit(userId, "account_change_denied", "wrong current password", ip);
    return { ok: false, error: "Your current password is not right." };
  }

  const sets: string[] = [];
  const args: unknown[] = [];
  const changed: string[] = [];

  const email = update.email?.trim().toLowerCase();
  if (email && email !== row.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "That email address does not look right." };
    }
    sets.push("email = ?");
    args.push(email);
    changed.push("email");
  }

  if (update.newPassword) {
    if (update.newPassword.length < MIN_PASSWORD) {
      return { ok: false, error: `Use at least ${MIN_PASSWORD} characters.` };
    }
    if (await verifyPassword(update.newPassword, row.password_hash)) {
      return { ok: false, error: "That is already your password." };
    }
    sets.push("password_hash = ?");
    args.push(await hashPassword(update.newPassword));
    changed.push("password");
  }

  if (!sets.length) return { ok: false, error: "Nothing to change." };

  try {
    await DB.prepare(`UPDATE admin_users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...args, userId)
      .run();
  } catch {
    // email is the only UNIQUE column on the table, so this is the only
    // constraint an update can trip.
    return { ok: false, error: "Another admin already uses that email address." };
  }

  if (update.newPassword) await destroyOtherSessions(userId, currentToken);

  await audit(userId, "account_changed", changed.join(","), ip);
  return { ok: true, email: email ?? row.email };
}
