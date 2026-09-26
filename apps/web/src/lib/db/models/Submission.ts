import mongoose, { Schema, type InferSchemaType } from "mongoose";

const SubmissionSchema = new Schema(
  {
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true, index: true },
    formVersionId: { type: Schema.Types.ObjectId, ref: "FormVersion", required: true },
    schemaVersion: { type: Number, required: true },
    answers: { type: Schema.Types.Mixed, required: true },
    idempotencyKey: { type: String, required: true },
    // Nullable until Phase 5c adds verified-email respondents.
    respondentIdentityId: { type: String, default: null },
    revisionNumber: { type: Number, default: 1 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Retrying the same submission attempt (double-click, network retry) must
// never create a second row for the same form.
SubmissionSchema.index({ formId: 1, idempotencyKey: 1 }, { unique: true });
SubmissionSchema.index({ formId: 1, submittedAt: -1 });

export type SubmissionDoc = InferSchemaType<typeof SubmissionSchema>;

export const SubmissionModel = mongoose.models.Submission ?? mongoose.model("Submission", SubmissionSchema);
