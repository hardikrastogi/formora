import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth/session";
import { newDraftId } from "@/lib/draft-id";

export default async function NewFormPage() {
  if (!(await getUserId())) redirect("/signin?next=/builder/new");
  redirect(`/builder/${newDraftId()}`);
}
