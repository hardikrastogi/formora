import { getMongoClient } from "@/lib/db/mongo-client";
import { getEnv } from "@/lib/env";

/**
 * How emails leave the app. Chosen by EMAIL_TRANSPORT:
 *   "console": logs the link to the server terminal and stores it in a
 *              dev-only `dev_email_outbox` collection (used by e2e tests).
 *              Local development only. Never set this on Vercel: anyone who
 *              can read the outbox or logs could sign in as anyone.
 *   "resend":  sends a real email through Resend's HTTP API.
 * With nothing set, development defaults to console; production is
 * validated (and RESEND_API_KEY/EMAIL_FROM's presence checked) by lib/env.ts.
 */
function transport(): "console" | "resend" {
  return getEnv().EMAIL_TRANSPORT ?? "console";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface OutgoingEmail {
  to: string;
  /** Plain text only; line breaks are removed so a value can never inject extra headers. */
  subject: string;
  text: string;
  html: string;
  /** The one link in the message. Printed by the console transport and stored for tests. */
  link: string;
}

export async function sendEmail(message: OutgoingEmail): Promise<void> {
  const subject = message.subject.replace(/[\r\n]+/g, " ").slice(0, 200);

  if (transport() === "console") {
    console.log(`\n[Formora] "${subject}" for ${message.to}:\n${message.link}\n`);
    const client = await getMongoClient();
    await client.db().collection("dev_email_outbox").insertOne({
      to: message.to,
      url: message.link,
      subject,
      createdAt: new Date(),
    });
    return;
  }

  // getEnv() already guarantees these are set whenever EMAIL_TRANSPORT is
  // "resend" — see the superRefine in lib/env.ts.
  const { RESEND_API_KEY: apiKey, EMAIL_FROM: from } = getEnv();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: message.to, subject, text: message.text, html: message.html }),
  });
  if (!res.ok) {
    // Deliberately not logging the response body: it can echo the address back.
    throw new Error(`Email provider rejected the message (HTTP ${res.status}).`);
  }
}
