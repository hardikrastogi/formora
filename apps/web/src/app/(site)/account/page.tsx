import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/env";
import { GoogleButton } from "@/components/google-button";
import { AccountSettings } from "./account-settings";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const userId = await getUserId();
  if (!userId) redirect("/signin?next=/account");

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Account</h1>
      <AccountSettings
        googleAvailable={isGoogleConfigured()}
        // Rendered server-side and handed down as a slot: GoogleButton's
        // server action imports @/auth (pulls in the Mongo driver), which
        // can't be bundled into AccountSettings's client-side code.
        googleButton={isGoogleConfigured() ? <GoogleButton next="/account" label="Connect Google" /> : null}
      />
    </div>
  );
}
