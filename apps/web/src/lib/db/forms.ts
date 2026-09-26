import { FormDefinitionSchema, type FormDefinition } from "@hardikrastogi/core";
import { connectToDatabase } from "./connect";
import { FormModel, type FormDoc } from "./models/Form";
import { FormVersionModel, type FormVersionDoc } from "./models/FormVersion";

export interface PublishedForm {
  formId: string;
  form: FormDoc;
  version: FormVersionDoc & { _id: unknown };
  definition: FormDefinition;
}

/**
 * Looks up a form by slug and returns its currently published version,
 * or null if the slug doesn't exist, has never been published, or was
 * unpublished. Callers should treat null as "respondent sees a 404."
 */
export async function getPublishedFormBySlug(slug: string): Promise<PublishedForm | null> {
  await connectToDatabase();

  const form = await FormModel.findOne({ slug }).lean<FormDoc & { _id: unknown }>();
  if (!form || !form.published || !form.currentVersionId) return null;

  const version = await FormVersionModel.findById(form.currentVersionId).lean<
    FormVersionDoc & { _id: unknown }
  >();
  if (!version) return null;

  const parsed = FormDefinitionSchema.safeParse(version.definition);
  if (!parsed.success) return null; // corrupted snapshot — fail closed, not with a broken form

  return { formId: String(form._id), form, version, definition: parsed.data };
}
