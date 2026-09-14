"use client";

import { useActionState } from "react";
import { resendVerificationAction, type VerificationState } from "./actions";

export default function VerifyEmailPage() {
  const [state, action, pending] = useActionState(resendVerificationAction, {} as VerificationState);
  return <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
    <h1 className="text-xl font-semibold">Verify your email</h1>
    <p className="text-subtle mt-2 text-sm">Open the verification link we sent before signing in or entering a product.</p>
    <form action={action} className="mt-5 space-y-3">
      <label className="block text-sm" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required maxLength={254} className="border-border bg-background h-10 w-full rounded-md border px-3" />
      {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}
      {state.message ? <p className="text-safe text-sm">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium">{pending ? "Sending…" : "Send a new link"}</button>
    </form>
  </div>;
}
