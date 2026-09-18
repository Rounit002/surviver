import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
        <Wordmark />
        <div className="flex items-center gap-3">
          <Link href="/board" className="text-[13px] text-subtle transition-colors hover:text-foreground">
            Watch the board
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        <div className="relative w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
