import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { DraftModel } from "@/lib/db/models/Draft";
import { getUserId } from "@/lib/auth/session";
import { isValidDraftId } from "@/lib/draft-id";

const MAX_DRAFT_BYTES = 1_000_000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  if (!isValidDraftId(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await connectToDatabase();
  const draft = await DraftModel.findOne({ ownerAccountId: userId, definitionId: id }).lean<{ definition: unknown } | null>();
  if (!draft) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ definition: draft.definition });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  if (!isValidDraftId(id)) return NextResponse.json({ error: "Invalid form id." }, { status: 400 });

  const text = await request.text();
  if (text.length > MAX_DRAFT_BYTES) {
    return NextResponse.json({ error: "This form is too large to save." }, { status: 413 });
  }
  let body: { definition?: { id?: unknown; name?: unknown } } | null;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  // A draft is only ever shown back to its owner, and publishing runs the full
  // schema check, so saving stays lenient: a half-edited form must still save.
  const definition = body?.definition;
  if (!definition || typeof definition !== "object" || definition.id !== id) {
    return NextResponse.json({ error: "The form's id must match the URL." }, { status: 422 });
  }

  await connectToDatabase();
  await DraftModel.updateOne(
    { ownerAccountId: userId, definitionId: id },
    { $set: { definition, name: typeof definition.name === "string" ? definition.name.slice(0, 200) : "" } },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
