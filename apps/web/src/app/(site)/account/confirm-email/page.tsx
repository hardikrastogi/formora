import type { Metadata } from "next";
import { ConfirmEmailForm } from "./confirm-email-form";

export const metadata: Metadata = {
  title: "Confirm email change",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Confirm your new email</h1>
      <ConfirmEmailForm token={typeof token === "string" ? token : ""} />
    </div>
  );
}
