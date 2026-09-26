import { getMongoClient } from "@/lib/db/mongo-client";

/**
 * How sign-in emails leave the app. Chosen by EMAIL_TRANSPORT:
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

export async function sendMagicLink(to: string, url: string): Promise<void> {
  if (transport() === "console") {
    console.log(`\n[Formora] Sign-in link for ${to}:\n${url}\n`);
    const client = await getMongoClient();
    await client.db().collection("dev_email_outbox").insertOne({ to, url, createdAt: new Date() });
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
    body: JSON.stringify({
      from,
      to,
      subject: "Your Formora sign-in link",
      text: `Sign in to Formora:\n\n${url}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
      html: `<p>Sign in to Formora:</p><p><a href="${url}">Sign in</a></p><p>This link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`,
    }),
  });
  if (!res.ok) {
    // Deliberately not logging the response body: it can echo the address back.
    throw new Error(`Email provider rejected the message (HTTP ${res.status}).`);
  }
}
