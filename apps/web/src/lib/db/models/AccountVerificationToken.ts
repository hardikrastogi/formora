import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * One emailed link for a creator-account action that must be proven by email
 * control before it takes effect: finishing a password signup, or resetting
 * a forgotten password. Same shape and same reasoning as 5c's
 * VerificationChallenge — only a hash of the token is stored, and each row
 * is single-use and short-lived.
 */
const AccountVerificationTokenSchema = new Schema(
  {
    purpose: { type: String, enum: ["signup", "reset"], required: true },
    email: { type: String, required: true },
    // For "signup" only: the password the person chose, already hashed. Copied
    // onto the user document only once the link is clicked, so an unverified
    // signup never creates or touches a real account.
    pendingPasswordHash: { type: String, default: null },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    ipHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

AccountVerificationTokenSchema.index({ purpose: 1, email: 1, createdAt: -1 });
AccountVerificationTokenSchema.index({ ipHash: 1, createdAt: -1 });
AccountVerificationTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 60 * 60 });

export type AccountVerificationTokenDoc = InferSchemaType<typeof AccountVerificationTokenSchema>;

export const AccountVerificationTokenModel =
  mongoose.models.AccountVerificationToken ??
  mongoose.model("AccountVerificationToken", AccountVerificationTokenSchema);
