import { NextResponse } from "next/server";
import { FormDefinitionSchema } from "@hardikrastogi/core";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { FormVersionModel } from "@/lib/db/models/FormVersion";
import { isValidSlug, slugify } from "@/lib/slug";

export async function POST(request: Request) {
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

  // Publishing again with the same slug republishes (bumps) that same form —
  // there's no separate "form ownership" check yet since creator accounts
  // arrive in Phase 5b. Two unrelated forms that happen to derive the same
  // slug would collide; a real slug-uniqueness UI is Phase 5b/5d work.
  const form = await FormModel.findOneAndUpdate(
    { slug },
    { $setOnInsert: { slug } },
    { new: true, upsert: true },
  );

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
