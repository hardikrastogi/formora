import { unstable_cache as nextCache, revalidateTag } from "next/cache";
import { FormDefinitionSchema, type FormDefinition } from "@hardikrastogi/core";
import { connectToDatabase } from "./connect";
import { FormModel, type FormDoc } from "./models/Form";
import { FormVersionModel, type FormVersionDoc } from "./models/FormVersion";

// A plain, JSON-safe shape — deliberately not the raw Mongoose `form`/
// `version` documents (they carry ObjectId/Date fields that don't round-trip
// cleanly through Next.js's cache serialization, and no caller ever needed
// more than this anyway).
export interface PublishedForm {
  formId: string;
  accessMode: "anyone" | "verified_email";
  closesAt: string | null;
  definition: FormDefinition;
}

export function formCacheTag(slug: string): string {
  return `form:${slug}`;
}

/** Called by the publish/unpublish routes right after they change a form, so a
 * republish or unpublish is reflected immediately instead of waiting out the
 * cache's own revalidate window. */
export function invalidatePublishedForm(slug: string): void {
  // { expire: 0 }: purge immediately rather than on some longer cacheLife
  // profile's schedule — a republish/unpublish should take effect right away.
  revalidateTag(formCacheTag(slug), { expire: 0 });
}

async function fetchPublishedForm(slug: string): Promise<PublishedForm | null> {
  await connectToDatabase();

  const form = await FormModel.findOne({ slug }).lean<FormDoc & { _id: unknown }>();
  if (!form || !form.published || !form.currentVersionId) return null;

  const version = await FormVersionModel.findById(form.currentVersionId).lean<
    FormVersionDoc & { _id: unknown }
  >();
  if (!version) return null;

  const parsed = FormDefinitionSchema.safeParse(version.definition);
  if (!parsed.success) return null; // corrupted snapshot — fail closed, not with a broken form

  return {
    formId: String(form._id),
    accessMode: form.accessMode as "anyone" | "verified_email",
    closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
    definition: parsed.data,
  };
}

/**
 * Looks up a form by slug and returns its currently published version,
 * or null if the slug doesn't exist, has never been published, or was
 * unpublished. Callers should treat null as "respondent sees a 404."
 *
 * Cached (60s, or until the publish/unpublish route explicitly invalidates
 * it via invalidatePublishedForm) since a published FormVersion is
 * immutable — a popular form's public page no longer costs a database read
 * per visitor. Deliberately NOT used by the submit route or anything else
 * that needs to see a genuinely live, uncached state (published/closesAt/
 * maxResponses checks) — those query FormModel/FormVersionModel directly.
 */
export async function getPublishedFormBySlug(slug: string): Promise<PublishedForm | null> {
  return nextCache(() => fetchPublishedForm(slug), ["published-form", slug], {
    tags: [formCacheTag(slug)],
    revalidate: 60,
  })();
}
