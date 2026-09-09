import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <Wordmark />
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4">
        <div className="relative text-center">
          <div className="num text-7xl font-semibold tracking-tighter text-border-strong sm:text-8xl">
            404
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            This one did not survive.
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-subtle">
            The page you are looking for was eliminated, renamed, or never entered.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <ButtonLink href="/board" variant="primary" size="sm">
              Browse the board
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="sm">
              Home
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
