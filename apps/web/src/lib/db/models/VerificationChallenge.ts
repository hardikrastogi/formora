import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * One emailed verification link. Only a SHA-256 hash of the token is stored,
 * so a database leak cannot be turned into working links. Each challenge is
 * single-use (`usedAt`) and short-lived (`expiresAt`).
 */
const VerificationChallengeSchema = new Schema(
  {
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true },
    email: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    // Keyed hash of the requester's IP, for rate limiting without storing raw addresses.
    ipHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Rate-limit lookups: recent requests per (form, email) and per IP.
VerificationChallengeSchema.index({ formId: 1, email: 1, createdAt: -1 });
VerificationChallengeSchema.index({ ipHash: 1, createdAt: -1 });
// Keep rows for two hours (longer than every rate-limit window), then let MongoDB delete them.
VerificationChallengeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 60 * 60 });

export type VerificationChallengeDoc = InferSchemaType<typeof VerificationChallengeSchema>;

export const VerificationChallengeModel =
  mongoose.models.VerificationChallenge ?? mongoose.model("VerificationChallenge", VerificationChallengeSchema);
