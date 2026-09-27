import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </div>
  );
}
