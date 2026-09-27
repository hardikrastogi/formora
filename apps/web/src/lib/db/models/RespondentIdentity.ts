import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * "This person proved they control this email address." It is NOT a Formora
 * account: respondents never sign up. Submissions point at this identity so
 * that a later phase can link them to an account created with the same
 * verified email, and never by matching text typed into a form field.
 */
const RespondentIdentitySchema = new Schema(
  {
    type: { type: String, enum: ["email"], required: true },
    // Lowercased and trimmed, so Ada@Example.com and ada@example.com are one person.
    normalizedValue: { type: String, required: true },
    verifiedAt: { type: Date, required: true },
    lastVerifiedAt: { type: Date, required: true },
    // Set in Phase 5d when a creator account with the same verified email exists.
    linkedAccountId: { type: String, default: null },
  },
  { timestamps: true },
);

RespondentIdentitySchema.index({ type: 1, normalizedValue: 1 }, { unique: true });

export type RespondentIdentityDoc = InferSchemaType<typeof RespondentIdentitySchema>;

export const RespondentIdentityModel =
  mongoose.models.RespondentIdentity ?? mongoose.model("RespondentIdentity", RespondentIdentitySchema);
