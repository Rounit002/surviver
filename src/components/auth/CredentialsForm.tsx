"use client";

import { useActionState } from "react";
import { LogoLoader } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field, FormError, Input } from "@/components/ui/Field";
import type { AuthFormState } from "@/lib/auth/actions";

export function CredentialsForm({
  action,
  submitLabel,
  includeName = false,
  next,
}: {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  includeName?: boolean;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as AuthFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormError>{state.error}</FormError>

      {includeName ? (
        <Field label="Your name" htmlFor="name" required error={state.fieldErrors?.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            aria-invalid={Boolean(state.fieldErrors?.name)}
            placeholder="Alex Rivera"
          />
        </Field>
      ) : null}

      <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          placeholder="you@company.com"
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
        hint={includeName ? "At least 10 characters." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={includeName ? "new-password" : "current-password"}
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
      </Field>

      {!includeName ? (
        <Field label="Admin verification code" htmlFor="mfaCode" error={state.fieldErrors?.mfaCode} hint="Required only for administrator accounts.">
          <Input id="mfaCode" name="mfaCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" aria-invalid={Boolean(state.fieldErrors?.mfaCode)} />
        </Field>
      ) : null}

      <Button type="submit" variant="primary" size="md" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LogoLoader className="size-4" />
            Working…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
