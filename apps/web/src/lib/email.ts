import { getMongoClient } from "@/lib/db/mongo-client";

/**
 * How emails leave the app. Chosen by EMAIL_TRANSPORT:
 *   "console": logs the link to the server terminal and stores it in a
 *              dev-only `dev_email_outbox` collection (used by e2e tests).
 *              Local development only. Never set this on Vercel: anyone who
 *              can read the outbox or logs could sign in as anyone.
 *   "resend":  sends a real email through Resend's HTTP API.
 * With nothing set, development defaults to console and production refuses.
 */
function transport(): "console" | "resend" {
  const configured = process.env.EMAIL_TRANSPORT;
  if (configured === "console" || configured === "resend") return configured;
  if (process.env.NODE_ENV !== "production") return "console";
  throw new Error("EMAIL_TRANSPORT must be set to 'resend' in production (see .env.example).");
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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be set when EMAIL_TRANSPORT=resend.");
  }

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
