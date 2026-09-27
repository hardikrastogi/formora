import { AccountVerificationTokenModel } from "@/lib/db/models/AccountVerificationToken";
import { connectToDatabase } from "@/lib/db/connect";
import { appOrigin } from "@/lib/app-origin";
import { escapeHtml, sendEmail } from "@/lib/email";
import { hashIp } from "@/lib/respondent-session";
import { RESEND_COOLDOWN_SECONDS, clientIp, hashToken, newToken } from "@/lib/respondent-verification";

const HOUR_MS = 60 * 60 * 1000;
const LINK_MINUTES = 15;
const MAX_PER_EMAIL_PER_HOUR = 5;
const MAX_PER_IP_PER_HOUR = 20;

export type AccountTokenPurpose = "signup" | "reset";

export class RateLimitedError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  pendingPasswordHash?: string | null;
}

/**
 * Creates a single-use, 15-minute link for a creator-account action and
 * emails it. Same rate limits as 5c's respondent verification, kept
 * per-purpose so a burst of signup attempts can't exhaust a password-reset
 * budget for the same address, or vice versa.
 */
export async function requestAccountToken(
  purpose: AccountTokenPurpose,
  email: string,
  request: Request,
  options: RequestOptions = {},
): Promise<void> {
  await connectToDatabase();
  const now = Date.now();
  const ipHash = hashIp(clientIp(request));

  const recentForEmail = await AccountVerificationTokenModel.find({
    purpose,
    email,
    createdAt: { $gt: new Date(now - HOUR_MS) },
  })
    .sort({ createdAt: -1 })
    .lean<{ createdAt: Date }[]>();

  const last = recentForEmail[0];
  if (last) {
    const waitMs = last.createdAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - now;
    if (waitMs > 0) {
      throw new RateLimitedError("Please wait a minute before asking for another link.", Math.ceil(waitMs / 1000));
    }
  }
  if (recentForEmail.length >= MAX_PER_EMAIL_PER_HOUR) {
    throw new RateLimitedError("Too many links were requested for this address. Try again later.", 60 * 60);
  }
  const fromThisIp = await AccountVerificationTokenModel.countDocuments({
    ipHash,
    createdAt: { $gt: new Date(now - HOUR_MS) },
  });
  if (fromThisIp >= MAX_PER_IP_PER_HOUR) {
    throw new RateLimitedError("Too many links were requested from your network. Try again later.", 60 * 60);
  }

  const token = newToken();
  await AccountVerificationTokenModel.create({
    purpose,
    email,
    pendingPasswordHash: options.pendingPasswordHash ?? null,
    tokenHash: hashToken(token),
    expiresAt: new Date(now + LINK_MINUTES * 60 * 1000),
    ipHash,
  });

  const path = purpose === "signup" ? "/verify-account" : "/reset-password";
  const link = `${appOrigin(request)}${path}?token=${token}`;
  const subject = purpose === "signup" ? "Verify your email for Formora" : "Reset your Formora password";
  const action = purpose === "signup" ? "finish creating your account" : "choose a new password";
  await sendEmail({
    to: email,
    subject,
    text: `Open this link to ${action}:\n\n${link}\n\nIt works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for this, ignore this email.`,
    html: `<p>Open this link to ${escapeHtml(action)}:</p><p><a href="${escapeHtml(link)}">Continue</a></p><p>It works once and expires in ${LINK_MINUTES} minutes. If you didn't ask for this, ignore this email.</p>`,
    link,
  });
}

interface ConsumedToken {
  email: string;
  pendingPasswordHash: string | null;
}

/** Atomically checks and consumes a token so a double-click or replay can never succeed twice. */
export async function consumeAccountToken(purpose: AccountTokenPurpose, token: string): Promise<ConsumedToken | null> {
  await connectToDatabase();
  const now = new Date();
  const challenge = await AccountVerificationTokenModel.findOneAndUpdate(
    { purpose, tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  ).lean<{ email: string; pendingPasswordHash: string | null } | null>();
  if (!challenge) return null;
  return { email: challenge.email, pendingPasswordHash: challenge.pendingPasswordHash ?? null };
}
