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


/**
 * Sends to someone who is not us — at the moment, a supplier being asked to
 * clarify their registration.
 *
 * Returns whether it actually went, which notify() has no need to do: that one
 * is a nudge to the owner and failing quietly is fine. This one is a message a
 * person is waiting for, and the admin screen has to be able to say "this was
 * not sent, here is a link to send it yourself" rather than implying it left.
 *
 * Replies come back to the site address rather than to whichever admin pressed
 * the button: the answer belongs with the registration, not in one inbox.
 */
export async function sendTo(
  to: string,
  subject: string,
  lines: string[]
): Promise<{ ok: boolean; reason?: string }> {
  const key = (env as unknown as { RESEND_API_KEY?: string }).RESEND_API_KEY;
  if (!key) return { ok: false, reason: "no-key" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, reason: "bad-address" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: TO,
        subject: subject.slice(0, 180),
        // Plain text, for the same reason notify() is: nothing a stranger
        // typed should reach a place that renders it.
        text: lines.join("\n"),
      }),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      console.error("[sendTo]", res.status, body);
      return { ok: false, reason: `http-${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[sendTo]", err);
    return { ok: false, reason: "threw" };
  }
}