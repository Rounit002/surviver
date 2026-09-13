"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { LogoLoader } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";

/**
 * A submit button that shows the mark while its own form is in flight.
 *
 * Forms posting straight to a server action have no pending state of their
 * own. `useFormStatus` reads it from the enclosing form, so only the button
 * has to become a client component and the page around it stays on the server.
 * Disabling while pending also stops a second submit, which matters on the
 * ones that take money or approve an entry.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? (
        <>
          <LogoLoader className={props.size === "sm" ? "size-3.5" : "size-4"} />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
