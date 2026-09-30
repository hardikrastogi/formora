import { connectToDatabase } from "@/lib/db/connect";
import { RespondentIdentityModel } from "@/lib/db/models/RespondentIdentity";
import { findUserByEmail } from "@/lib/auth/users";

/**
 * Connects a verified respondent identity to a creator account with the
 * same email, the moment both exist — regardless of which one came first.
 * Called from three places, since either order is possible:
 *   1. A creator account is created/confirmed (password signup, magic
 *      link, or Google) — the identity might already exist from an earlier
 *      verified submission.
 *   2. A respondent verifies an email for the first time — a creator
 *      account with that email might already exist.
 * Both call sites just call this with the email; it's a no-op unless both
 * sides genuinely exist and aren't linked yet. Never links on anything
 * other than a matching *normalized, proven* email — never by reading an
 * email typed into an ordinary form answer field.
 */
export async function linkRespondentIdentity(email: string): Promise<void> {
  await connectToDatabase();
  const identity = await RespondentIdentityModel.findOne({ type: "email", normalizedValue: email });
  if (!identity || identity.linkedAccountId) return;

  const user = await findUserByEmail(email);
  if (!user) return;

  identity.linkedAccountId = String(user._id);
  await identity.save();
}
