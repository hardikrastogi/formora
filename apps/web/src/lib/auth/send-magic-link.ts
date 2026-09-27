import { escapeHtml, sendEmail } from "@/lib/email";

/** The creator sign-in email. Delivery itself lives in lib/email.ts. */
export async function sendMagicLink(to: string, url: string): Promise<void> {
  await sendEmail({
    to,
    subject: "Your Formora sign-in link",
    text: `Sign in to Formora:\n\n${url}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
    html: `<p>Sign in to Formora:</p><p><a href="${escapeHtml(url)}">Sign in</a></p><p>This link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`,
    link: url,
  });
}
