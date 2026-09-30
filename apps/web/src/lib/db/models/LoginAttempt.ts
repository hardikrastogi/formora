import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * One failed password-login attempt. Recorded whether or not the email
 * actually has an account — a nonexistent email must be rate-limited
 * identically to a real one, or an attacker could tell them apart purely by
 * which ones eventually get locked out.
 *
 * Never records the password itself, and never records a *successful*
 * login — only failures count toward a lockout.
 */
const LoginAttemptSchema = new Schema(
  {
    email: { type: String, required: true },
    // Keyed hash (see hashIp in respondent-session.ts), never the raw address.
    ipHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

LoginAttemptSchema.index({ email: 1, createdAt: -1 });
LoginAttemptSchema.index({ ipHash: 1, createdAt: -1 });
// Kept just long enough to cover the lockout window with room to spare, then
// MongoDB deletes them itself — this is telemetry for the current attack, not
// a permanent log.
LoginAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 });

export type LoginAttemptDoc = InferSchemaType<typeof LoginAttemptSchema>;

export const LoginAttemptModel = mongoose.models.LoginAttempt ?? mongoose.model("LoginAttempt", LoginAttemptSchema);
