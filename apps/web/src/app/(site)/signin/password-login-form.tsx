"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { loginWithPassword, type SignInState } from "./actions";

export function PasswordLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(loginWithPassword, { error: null });
  // Controlled, not left to the DOM: React resets a form's uncontrolled
  // fields once its action finishes, so after a failed attempt the email
  // would otherwise vanish along with the password, forcing it to be retyped.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={action} aria-label="Log in with password" className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="password-login-email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="password-login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password-login-password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password-login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
