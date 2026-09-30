import { NextResponse } from "next/server";
import { FormDefinitionSchema } from "@hardikrastogi/core";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { FormVersionModel } from "@/lib/db/models/FormVersion";
import { isValidSlug, slugify } from "@/lib/slug";
import { getUserId } from "@/lib/auth/session";
import { invalidatePublishedForm } from "@/lib/db/forms";

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in to publish a form." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const {
    definition,
    slug: requestedSlug,
    accessMode,
    closesAt,
    maxResponses,
    limitOneResponsePerRespondent,
    allowResponseEditing,
  } = (body ?? {}) as {
    definition?: unknown;
    slug?: unknown;
    accessMode?: unknown;
    closesAt?: unknown;
    maxResponses?: unknown;
    limitOneResponsePerRespondent?: unknown;
    allowResponseEditing?: unknown;
  };
  if (accessMode !== undefined && accessMode !== "anyone" && accessMode !== "verified_email") {
    return NextResponse.json({ error: "accessMode must be 'anyone' or 'verified_email'." }, { status: 422 });
  }
  // closesAt: null clears it, a date string sets it, and leaving the key out
  // entirely (older callers, tests) keeps whatever the form already has —
  // same "don't touch what you weren't told about" rule accessMode follows.
  let parsedClosesAt: Date | null | undefined;
  if ("closesAt" in (body as Record<string, unknown>)) {
    if (closesAt === null) {
      parsedClosesAt = null;
    } else if (typeof closesAt === "string") {
      const date = new Date(closesAt);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Enter a valid close date and time." }, { status: 422 });
      }
      parsedClosesAt = date;
    } else {
      return NextResponse.json({ error: "closesAt must be a date string or null." }, { status: 422 });
    }
  }
  // Same null-clears/omit-keeps rule as closesAt.
  let parsedMaxResponses: number | null | undefined;
  if ("maxResponses" in (body as Record<string, unknown>)) {
    if (maxResponses === null) {
      parsedMaxResponses = null;
    } else if (typeof maxResponses === "number" && Number.isInteger(maxResponses) && maxResponses > 0) {
      parsedMaxResponses = maxResponses;
    } else {
      return NextResponse.json({ error: "maxResponses must be a positive whole number, or null." }, { status: 422 });
    }
  }
  if (limitOneResponsePerRespondent !== undefined && typeof limitOneResponsePerRespondent !== "boolean") {
    return NextResponse.json({ error: "limitOneResponsePerRespondent must be true or false." }, { status: 422 });
  }
  if (allowResponseEditing !== undefined && typeof allowResponseEditing !== "boolean") {
    return NextResponse.json({ error: "allowResponseEditing must be true or false." }, { status: 422 });
  }
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
  // Left as-is when the caller doesn't say, so republishing never silently loosens who may respond.
  if (accessMode) form.accessMode = accessMode;
  if (parsedClosesAt !== undefined) form.closesAt = parsedClosesAt;
  if (parsedMaxResponses !== undefined) form.maxResponses = parsedMaxResponses;
  // No access-mode restriction here, unlike limitOneResponsePerRespondent — the
  // edit-token mechanism works the same for anonymous and verified respondents.
  if (allowResponseEditing !== undefined) form.allowResponseEditing = allowResponseEditing;

  // limitOneResponsePerRespondent only means anything with a real identity to
  // key on — enforcing it for anyone-mode would pretend to a guarantee
  // anonymous submissions can't actually provide (see ROADMAP.md's own note
  // on this). Checked against the *effective* access mode (the one just set,
  // or the form's existing one if this call didn't change it).
  const effectiveAccessMode = accessMode ?? form.accessMode;
  if (limitOneResponsePerRespondent === true && effectiveAccessMode !== "verified_email") {
    return NextResponse.json(
      { error: "Limiting to one response per respondent requires the 'verified email' access mode." },
      { status: 422 },
    );
  }
  if (effectiveAccessMode !== "verified_email") {
    // Force-clear rather than merely refuse to set: switching a form back to
    // "anyone" must not leave a stale true value in place from when it used
    // to be a verified_email form, which would otherwise silently pretend to
    // still enforce a guarantee anonymous mode can't provide.
    form.limitOneResponsePerRespondent = false;
  } else if (limitOneResponsePerRespondent !== undefined) {
    form.limitOneResponsePerRespondent = limitOneResponsePerRespondent;
  }

  const version = await FormVersionModel.create({
    formId: form._id,
    schemaVersion: parsed.data.schemaVersion,
    definition: parsed.data,
  });

  form.published = true;
  form.currentVersionId = version._id;
  await form.save();
  invalidatePublishedForm(form.slug);

  return NextResponse.json(
    {
      slug: form.slug,
      url: `/f/${form.slug}`,
      accessMode: form.accessMode,
      closesAt: form.closesAt ? form.closesAt.toISOString() : null,
      maxResponses: form.maxResponses ?? null,
      limitOneResponsePerRespondent: form.limitOneResponsePerRespondent,
      allowResponseEditing: form.allowResponseEditing,
    },
    { status: 200 },
  );
}
