import type { Metadata } from "next";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sign out" };

async function doSignOut() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default function SignOutPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Sign out</h1>
      <p className="mt-2 text-sm text-muted-foreground">You will need a new email link to sign back in.</p>
      <form action={doSignOut} className="mt-6">
        <Button type="submit">Sign out</Button>
      </form>
    </div>
  );
}
