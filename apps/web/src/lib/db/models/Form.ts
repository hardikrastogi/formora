import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Hosting metadata only — slug, published state, which version is live.
 * The actual form JSON lives in FormVersion, never here, so this stays
 * out of the portable @hardikrastogi/core FormDefinition schema.
 */
const FormSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    // Nullable until Phase 5b adds creator accounts.
    ownerAccountId: { type: String, default: null },
    published: { type: Boolean, default: false },
    currentVersionId: { type: Schema.Types.ObjectId, ref: "FormVersion", default: null },
    allowResponseEditing: { type: Boolean, default: false },
    limitOneResponsePerRespondent: { type: Boolean, default: false },
    closesAt: { type: Date, default: null },
    maxResponses: { type: Number, default: null },
  },
  { timestamps: true },
);

export type FormDoc = InferSchemaType<typeof FormSchema>;

export const FormModel = mongoose.models.Form ?? mongoose.model("Form", FormSchema);
