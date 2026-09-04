/**
 * Creates or resets an admin user.
 *
 *   node scripts/create-admin.mts <email> [--role owner|editor|moderator] [--local]
 *
 * Generates a password and prints it once, to the terminal, and never stores
 * it. To set a chosen password instead, pass it in the environment rather
 * than on the command line, which would leave it in shell history and in the
 * process list:
 *
 *   ADMIN_PASSWORD='...' node scripts/create-admin.mts someone@example.com
 *
 * The hash uses the same PBKDF2 parameters as src/lib/auth.ts so the two agree.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { webcrypto as crypto } from "node:crypto";

const email = process.argv[2];
if (!email || email.startsWith("--")) {
  console.error("usage: node scripts/create-admin.mts <email> [--role owner|editor|moderator] [--local]");
  process.exit(1);
}
const LOCAL = process.argv.includes("--local");

const roleFlag = process.argv.indexOf("--role");
const ROLE = roleFlag > -1 ? process.argv[roleFlag + 1] : "owner";
if (!["owner", "editor", "moderator"].includes(ROLE)) {
  console.error(`unknown role: ${ROLE}`);
  process.exit(1);
}
// Workers caps PBKDF2 at 100k iterations, so the work factor comes from
// chaining rounds. Must stay in step with src/lib/auth.ts.
const ITER = 100_000;
const ROUNDS = 3;

const b64 = (b: ArrayBuffer) => Buffer.from(new Uint8Array(b)).toString("base64");

// Ambiguous glyphs left out: this gets read off a screen and typed back in.
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// A supplied password comes through the environment, never argv: argv shows
// up in shell history and in the process list.
const supplied = process.env.ADMIN_PASSWORD;
const generated = !supplied;
if (supplied && supplied.length < 8) {
  console.error("that password is too short to protect an admin account");
  process.exit(1);
}
const password =
  supplied ??
  [...crypto.getRandomValues(new Uint8Array(20))]
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join("");

const salt = crypto.getRandomValues(new Uint8Array(16));
let material: BufferSource = new TextEncoder().encode(password);
let bits = new ArrayBuffer(0);
for (let i = 0; i < ROUNDS; i++) {
  const key = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, key, 256);
  material = bits;
}
const hash = `pbkdf2r${ROUNDS}$${ITER}$${b64(salt.buffer)}$${b64(bits)}`;

const sql =
  `INSERT INTO admin_users (email, password_hash, role, created_at) ` +
  `VALUES ('${email.toLowerCase().replace(/'/g, "''")}', '${hash}', '${ROLE}', '${new Date().toISOString()}') ` +
  `ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash, failed_count=0, locked_until=NULL;`;

// Via a file, not --command: on Windows the shell splits the statement on
// spaces and wrangler sees a dozen unknown arguments.
const tmp = join(process.cwd(), ".admin.sql");
writeFileSync(tmp, sql, "utf8");
const res = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", "dubai-schools", LOCAL ? "--local" : "--remote", `--file=${tmp}`],
  { stdio: "pipe", shell: true, encoding: "utf8" }
);
try { unlinkSync(tmp); } catch {}
if (res.status !== 0) {
  console.error(res.stderr || res.stdout);
  process.exit(1);
}

console.log("\n  admin created / password reset");
console.log("  email    :", email);
console.log("  role     :", ROLE);
if (generated) {
  console.log("  password :", password);
  console.log("\n  Shown once. Store it in a password manager now.\n");
} else {
  // Not echoed: it came from the caller, who has it already.
  console.log("  password : (the one you supplied)\n");
}
