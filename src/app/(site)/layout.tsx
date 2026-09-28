import { Suspense } from "react";
import { EntryDialog } from "@/components/entry/EntryDialog";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getOpenSeason, getSeasonSummary } from "@/lib/competition/season";
import { formatMoney } from "@/lib/format";
import { HumanCheck } from "@/components/security/HumanCheck";
import { env } from "@/lib/env";
import { getVisitorContext } from "@/lib/tracking/visitor";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {/* The nav is sticky rather than fixed, so it stays in the flow and the
          page below it needs no compensating offset. */}
      <main className="flex-1">{children}</main>
      <SiteFooter />
      {/* One entry dialog for the whole site, so every "Claim a spot" opens
          it in place instead of navigating. Streams in after the page. */}
      <Suspense fallback={null}>
        <SiteEntryDialog />
      </Suspense>
      <Suspense fallback={null}>
        <SiteHumanCheck />
      </Suspense>
    </>
  );
}

/** Only rendered for a browser without a current human pass. */
async function SiteHumanCheck() {
  if (!env.turnstileEnabled) return null;
  const visitor = await getVisitorContext();
  if (visitor.human || visitor.visitorId === "anonymous") return null;
  return <HumanCheck siteKey={env.turnstileSiteKey} />;
}

async function SiteEntryDialog() {
  const open = await getOpenSeason();
  const summary = open ? await getSeasonSummary(open) : null;
  return (
    <EntryDialog
      available={summary?.acceptingEntries ?? false}
      full={summary?.isFull ?? false}
      priceLabel={open ? formatMoney(open.entryPriceCents, open.currency) : undefined}
    />
  );
}
