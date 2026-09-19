import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {/* The nav is sticky rather than fixed, so it stays in the flow and the
          page below it needs no compensating offset. */}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
