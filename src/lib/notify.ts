import { env } from "cloudflare:workers";

/**
 * Tells the site owner that something arrived.
 *
 * Deliberately best-effort: a submission is already saved to the database by
 * the time this runs, so a mail failure must never turn a saved submission
 * into an error the visitor sees. Everything here either sends or logs.
 *
 * Needs RESEND_API_KEY as a Worker secret. Without it this is a no-op, which
 * is the correct behaviour in local dev and in any deploy where mail has not
 * been set up yet.
 */
const FROM = "Dubai Schools <dubai-schools@can-du-ai.com>";
const TO = "dubai-schools@can-du-ai.com";

export async function notify(subject: string, lines: string[]): Promise<void> {
  const key = (env as unknown as { RESEND_API_KEY?: string }).RESEND_API_KEY;
  if (!key) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: subject.slice(0, 180),
        // Plain text on purpose. Nobody but the owner reads these, and text
        // cannot carry anything a submitter typed into somewhere it executes.
        text: lines.join("\n"),
      }),
    });
    if (!res.ok) {
      console.error("[notify]", res.status, (await res.text().catch(() => "")).slice(0, 200));
    }
  } catch (err) {
    console.error("[notify]", err);
  }
}
