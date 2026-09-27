import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

/** A plain POST, not a link — matches how /signout works, and how NextAuth expects OAuth sign-in to be triggered. */
export function GoogleButton({ next, label }: { next: string; label: string }) {
  async function continueWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: next });
  }

  return (
    <form action={continueWithGoogle}>
      <Button type="submit" variant="outline" className="w-full">
        {label}
      </Button>
    </form>
  );
}
