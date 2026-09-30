import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { RespondentIdentityModel } from "@/lib/db/models/RespondentIdentity";
import { VerificationChallengeModel } from "@/lib/db/models/VerificationChallenge";
import { appOrigin } from "@/lib/app-origin";
import {
  RESPONDENT_SESSION_SECONDS,
  createRespondentToken,
  respondentCookieName,
} from "@/lib/respondent-session";
import { hashToken } from "@/lib/respondent-verification";
import { linkRespondentIdentity } from "@/lib/account-linking";

/**
 * The respondent pressed "Continue to form" on the page the emailed link
 * opens. This is a POST on purpose: mail scanners and link previewers fetch
 * links with GET, and they must not be able to use up a single-use token.
 */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const token = (body as { token?: unknown } | null)?.token;
  if (typeof token !== "string" || token.length < 20 || token.length > 200) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
  }

  await connectToDatabase();
  const form = await FormModel.findOne({ slug });
  if (!form || !form.published || form.accessMode !== "verified_email") {
    return NextResponse.json({ error: "This form does not need email verification." }, { status: 404 });
  }

  // One atomic step both checks and consumes the token, so two simultaneous
  // clicks (or a replay) can never both succeed.
  const now = new Date();
  const challenge = await VerificationChallengeModel.findOneAndUpdate(
    { formId: form._id, tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  ).lean<{ email: string } | null>();
  if (!challenge) {
    return NextResponse.json({ error: "This link has expired or was already used." }, { status: 410 });
  }

  const identity = await RespondentIdentityModel.findOneAndUpdate(
    { type: "email", normalizedValue: challenge.email },
    { $set: { lastVerifiedAt: now }, $setOnInsert: { verifiedAt: now } },
    { upsert: true, new: true },
  );
  // Phase 5d: a creator account with this same email might already exist —
  // connect the two, without ever creating a Formora account for the
  // respondent themselves.
  await linkRespondentIdentity(challenge.email);

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(respondentCookieName(String(form._id)), createRespondentToken(String(identity._id), String(form._id)), {
    httpOnly: true,
    sameSite: "lax",
    // Secure cookies only travel over https; follow the configured public address.
    secure: appOrigin(request).startsWith("https://"),
    path: "/",
    maxAge: RESPONDENT_SESSION_SECONDS,
  });
  return response;
}
