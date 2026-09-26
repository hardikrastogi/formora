import mongoose, { Schema } from "mongoose";

/**
 * A creator's work-in-progress form: what the builder autosaves. Separate
 * from Form/FormVersion, which only exist once something is published.
 * Unique per (owner, definitionId), so two creators can each have a draft
 * with the same id without seeing each other's.
 */
const DraftSchema = new Schema(
  {
    ownerAccountId: { type: String, required: true },
    definitionId: { type: String, required: true },
    name: { type: String, default: "" },
    definition: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
DraftSchema.index({ ownerAccountId: 1, definitionId: 1 }, { unique: true });

export const DraftModel = mongoose.models.Draft ?? mongoose.model("Draft", DraftSchema);
