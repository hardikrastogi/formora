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
    // Lets the respondent's own browser recognise "I already answered this"
    // after a refresh, and lets them come back later to edit their answer,
    // all without a Formora account. Only the hash is stored — see
    // /api/forms/[slug]/submission/*. Nullable so old submissions from
    // before this field existed just can't be looked up or edited.
    editTokenHash: { type: String, default: null },
    // A lowercased, space-joined copy of every string/number answer,
    // recomputed on every submit and edit. Backs the response dashboard's
    // search box — a plain substring match over one field, not a real search
    // engine, but sized to how few responses one form realistically has.
    searchText: { type: String, default: "" },
  },
  { timestamps: true },
);

// Retrying the same submission attempt (double-click, network retry) must
// never create a second row for the same form.
SubmissionSchema.index({ formId: 1, idempotencyKey: 1 }, { unique: true });
// _id as a tiebreaker keeps sort order stable even if two submissions land
// in the exact same millisecond (the responses list sorts by both).
SubmissionSchema.index({ formId: 1, submittedAt: -1, _id: -1 });
// Powers "Your responses" (Phase 5d account linking) — every submission a
// given verified identity ever made, across every form, newest first.
SubmissionSchema.index({ respondentIdentityId: 1, submittedAt: -1 });

export type SubmissionDoc = InferSchemaType<typeof SubmissionSchema>;

export const SubmissionModel = mongoose.models.Submission ?? mongoose.model("Submission", SubmissionSchema);
