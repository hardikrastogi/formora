import { redirect } from "next/navigation";

// The builder edits one specific form, so the bare /builder address just
// sends people to their list of forms (which asks them to sign in first).
export default function Page() {
  redirect("/dashboard");
}
