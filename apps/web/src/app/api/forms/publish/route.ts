import { NextResponse } from "next/server";
import { FormDefinitionSchema } from "@hardikrastogi/core";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { FormVersionModel } from "@/lib/db/models/FormVersion";
import { isValidSlug, slugify } from "@/lib/slug";
import { getUserId } from "@/lib/auth/session";

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to publish a form." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { definition, slug: requestedSlug } = (body ?? {}) as { definition?: unknown; slug?: unknown };
  const parsed = FormDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid FormDefinition.", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const slug =
    typeof requestedSlug === "string" && requestedSlug.trim()
      ? slugify(requestedSlug)
      : slugify(parsed.data.id);
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Could not derive a valid slug from this form." }, { status: 422 });
  }

  await connectToDatabase();

  // Publishing again with the same slug republishes that form, but only for
  // its owner. A form with no owner predates accounts, and is claimed by the
  // first signed-in creator to publish it.
  const form = await FormModel.findOneAndUpdate(
    { slug },
    { $setOnInsert: { slug, ownerAccountId: userId } },
    { new: true, upsert: true },
  );
  if (form.ownerAccountId && form.ownerAccountId !== userId) {
    return NextResponse.json({ error: "That link name is already taken." }, { status: 403 });
  }
  form.ownerAccountId = userId;

  const version = await FormVersionModel.create({
    formId: form._id,
    schemaVersion: parsed.data.schemaVersion,
    definition: parsed.data,
  });

  form.published = true;
  form.currentVersionId = version._id;
  await form.save();

  return NextResponse.json({ slug: form.slug, url: `/f/${form.slug}` }, { status: 200 });
}
