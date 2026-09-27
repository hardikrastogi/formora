import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { FormVersionModel } from "@/lib/db/models/FormVersion";
import { VerificationChallengeModel } from "@/lib/db/models/VerificationChallenge";
import { appOrigin } from "@/lib/app-origin";
import { escapeHtml, sendEmail } from "@/lib/email";
import { hashIp } from "@/lib/respondent-session";
import {
  MAX_LINKS_PER_EMAIL_PER_HOUR,
  MAX_LINKS_PER_IP_PER_HOUR,
  RESEND_COOLDOWN_SECONDS,
  VERIFICATION_LINK_MINUTES,
  clientIp,
  hashToken,
  newToken,
  normalizeEmail,
} from "@/lib/respondent-verification";

const HOUR_MS = 60 * 60 * 1000;

function tooMany(message: string, retryAfterSeconds: number) {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/**
 * A respondent asks for a verification link for a form that requires a
 * verified email. The answer is the same whether or not that address has
 * ever been seen, so this endpoint cannot be used to probe who has responded.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const email = normalizeEmail((body as { email?: unknown } | null)?.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 });

  await connectToDatabase();
  const form = await FormModel.findOne({ slug });
  if (!form || !form.published || form.accessMode !== "verified_email") {
    return NextResponse.json({ error: "This form does not need email verification." }, { status: 404 });
  }

  const now = Date.now();
  const ipHash = hashIp(clientIp(request));

  // Rate limits. All are counted from stored challenges, so they survive restarts and work across servers.
  const recentForEmail = await VerificationChallengeModel.find({
    formId: form._id,
    email,
    createdAt: { $gt: new Date(now - HOUR_MS) },
  })
    .sort({ createdAt: -1 })
    .lean<{ createdAt: Date }[]>();

  const last = recentForEmail[0];
  if (last) {
    const waitMs = last.createdAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - now;
    if (waitMs > 0) {
      return tooMany("Please wait a minute before asking for another link.", Math.ceil(waitMs / 1000));
    }
  }
  if (recentForEmail.length >= MAX_LINKS_PER_EMAIL_PER_HOUR) {
    return tooMany("Too many links were requested for this address. Try again later.", 60 * 60);
  }
  const fromThisIp = await VerificationChallengeModel.countDocuments({
    ipHash,
    createdAt: { $gt: new Date(now - HOUR_MS) },
  });
  if (fromThisIp >= MAX_LINKS_PER_IP_PER_HOUR) {
    return tooMany("Too many links were requested from your network. Try again later.", 60 * 60);
  }

  const token = newToken();
  await VerificationChallengeModel.create({
    formId: form._id,
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(now + VERIFICATION_LINK_MINUTES * 60 * 1000),
    ipHash,
  });

  const version = await FormVersionModel.findById(form.currentVersionId).lean<{
    definition?: { name?: unknown };
  } | null>();
  const formName = typeof version?.definition?.name === "string" ? version.definition.name : "a form";

  const link = `${appOrigin(request)}/f/${encodeURIComponent(slug)}/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: `Verify your email to fill out ${formName}`,
    text: `Open this link to continue to "${formName}":\n\n${link}\n\nIt works once and expires in ${VERIFICATION_LINK_MINUTES} minutes. If you didn't ask for it, ignore this email.`,
    // The form name is chosen by the creator, so it is escaped before going into HTML.
    html: `<p>Open this link to continue to <strong>${escapeHtml(formName)}</strong>:</p><p><a href="${escapeHtml(link)}">Continue to form</a></p><p>It works once and expires in ${VERIFICATION_LINK_MINUTES} minutes. If you didn't ask for it, ignore this email.</p>`,
    link,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
