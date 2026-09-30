import { FormModel, type FormDoc } from "@/lib/db/models/Form";
import { connectToDatabase } from "@/lib/db/connect";

/**
 * The one ownership check every response list/detail/export endpoint uses —
 * a form that exists but belongs to someone else looks exactly like a
 * missing one, so a slug can never be probed for who owns what (same rule
 * publish/unpublish already follow).
 */
export async function getOwnedForm(slug: string, userId: string): Promise<(FormDoc & { _id: unknown }) | null> {
  await connectToDatabase();
  return FormModel.findOne({ slug, ownerAccountId: userId }).lean<(FormDoc & { _id: unknown }) | null>();
}
