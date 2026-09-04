import { env } from "cloudflare:workers";

const DB = (env as unknown as { DB: D1Database }).DB;

/**
 * Site settings an admin can change without a deploy.
 *
 * The table has been in the schema since 0001 and unused until now: key, value,
 * and who set it last. Values are stored as text and read back through the
 * helpers below, so a caller never has to know that "1" means true.
 */

/** Paid packages are hidden on the advertising page while this is set. The
 *  free Verified tier always shows: claiming a listing costs nothing and is
 *  the thing the page is actually for. */
export const HIDE_PAID_TIERS = "advertise.hide_paid_tiers";

export async function getSetting(key: string): Promise<string | null> {
  const row = await DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function getFlag(key: string): Promise<boolean> {
  return (await getSetting(key)) === "1";
}

export async function setSetting(
  key: string,
  value: string,
  userId: number | null
): Promise<void> {
  await DB.prepare(
    `INSERT INTO settings (key, value, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  )
    .bind(key, value, new Date().toISOString(), userId)
    .run();
}

export async function setFlag(
  key: string,
  on: boolean,
  userId: number | null
): Promise<void> {
  await setSetting(key, on ? "1" : "0", userId);
}

/** Who last touched a setting, for the admin screen to show. */
export async function settingMeta(
  key: string
): Promise<{ updated_at: string | null; email: string | null } | null> {
  return await DB.prepare(
    `SELECT s.updated_at, u.email
     FROM settings s LEFT JOIN admin_users u ON u.id = s.updated_by
     WHERE s.key = ?`
  )
    .bind(key)
    .first<{ updated_at: string | null; email: string | null }>();
}
