import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { FormModel } from "@/lib/db/models/Form";
import { getUserId } from "@/lib/auth/session";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { slug } = await context.params;
  await connectToDatabase();

  // Matching on the owner too means someone else's form looks exactly like a
  // missing one: 404, so slugs can't be probed for who owns what.
  const form = await FormModel.findOneAndUpdate(
    { slug, ownerAccountId: userId },
    { $set: { published: false } },
    { new: true },
  );
  if (!form) {
    return NextResponse.json({ error: "No form found for this slug." }, { status: 404 });
  }

  // Existing responses and the form itself are untouched — only new
  // submissions are rejected (enforced in the submit route).
  return NextResponse.json({ slug: form.slug, published: form.published }, { status: 200 });
}
