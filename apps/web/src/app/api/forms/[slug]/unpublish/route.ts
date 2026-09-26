import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  await connectToDatabase();

  const form = await FormModel.findOneAndUpdate({ slug }, { $set: { published: false } }, { new: true });
  if (!form) {
    return NextResponse.json({ error: "No form found for this slug." }, { status: 404 });
  }

  // Existing responses and the form itself are untouched — only new
  // submissions are rejected (enforced in the submit route).
  return NextResponse.json({ slug: form.slug, published: form.published }, { status: 200 });
}
