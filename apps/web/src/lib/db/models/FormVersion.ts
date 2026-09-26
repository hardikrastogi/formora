import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * An immutable snapshot of a FormDefinition at the moment it was published.
 * Editing the form after publish creates a NEW FormVersion — it never
 * mutates one a respondent may have already answered.
 */
const FormVersionSchema = new Schema(
  {
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true, index: true },
    schemaVersion: { type: Number, required: true },
    definition: { type: Schema.Types.Mixed, required: true },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type FormVersionDoc = InferSchemaType<typeof FormVersionSchema>;

export const FormVersionModel = mongoose.models.FormVersion ?? mongoose.model("FormVersion", FormVersionSchema);
