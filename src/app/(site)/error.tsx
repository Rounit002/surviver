"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[surviver] route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="label text-danger">Signal lost</div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Something broke on our side.</h1>
      <p className="mt-2 text-sm leading-relaxed text-subtle">
        The competition is still running. This page just failed to render.
      </p>
      {error.digest ? (
        <p className="num mt-4 text-[11px] text-faint">Reference {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-2">
        <Button variant="primary" size="sm" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary" size="sm">
          Back to the board
        </ButtonLink>
      </div>
    </div>
  );
}
