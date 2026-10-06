import Link from "next/link";
import { Crown } from "lucide-react";
import { siFigma, siNotion, siStripe, type SimpleIcon } from "simple-icons";
import { SiteFavicon } from "@/components/product/SiteFavicon";
import { Icon } from "@/components/ui/Icon";
import { formatCount } from "@/lib/format";

export type PodiumEntry = {
  id: string;
  name: string;
  url: string;
  logoUrl: string | null;
  clicks: number;
};

/**
 * The hero's podium, drawn from the logo: the mark's three bars — tall in the
 * middle, short either side — become first, second and third, with second a
 * step above third so the order reads at a glance. It stands straight on the
 * page, on a hairline floor, with no card around it.
 *
 * While a season is live it holds the real top three and their real clicks.
 * Before that it shows what it will look like with real SaaS marks, labelled
 * as a preview and with no figures, because naming a leader among products
 * that have not competed yet would be a false claim about real entrants.
 */
const STEPS = [
  { rank: 1, order: 2, height: "11rem", tone: "var(--color-primary)", ink: "var(--color-primary-foreground)", delay: 0 },
  { rank: 2, order: 1, height: "7.75rem", tone: "var(--color-accent)", ink: "#ffffff", delay: 120 },
  { rank: 3, order: 3, height: "5.5rem", tone: "var(--color-accent-soft)", ink: "var(--color-accent)", delay: 240 },
] as const;

/** The preview's stand-ins, first to third. */
const PREVIEW: SimpleIcon[] = [siStripe, siFigma, siNotion];

export function HeroPodium({ top, live, seasonName, capacity, filled }: { top: PodiumEntry[]; live: boolean; seasonName: string; capacity: number; filled: number }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-2 text-sm font-semibold">
        {live ? <span className="pulse-dot bg-live size-2 rounded-full" aria-label="Live" /> : null}
        {seasonName} podium
      </p>

      <ol className="podium mt-6" aria-label={live ? "Top three by clicks" : "Podium preview"}>
        {STEPS.map((step) => {
          const entry = live ? top[step.rank - 1] : undefined;
          const preview = live ? undefined : PREVIEW[step.rank - 1];
          return (
            <li key={step.rank} className="podium-col" style={{ order: step.order }}>
              <div className="podium-head" style={{ animationDelay: `${step.delay + 380}ms` }}>
                <span className="relative">
                  {step.rank === 1 ? (
                    <span className="podium-crown" aria-hidden>
                      <Crown width={30} height={30} strokeWidth={1.75} />
                    </span>
                  ) : null}
                  {entry ? (
                    <SiteFavicon name={entry.name} siteUrl={entry.url} logoUrl={entry.logoUrl} className={`podium-tile size-13 rounded-[14px] ${step.rank === 1 ? "podium-tile-first" : ""}`} />
                  ) : preview ? (
                    <span className={`podium-tile flex size-13 items-center justify-center rounded-[14px] ${step.rank === 1 ? "podium-tile-first" : ""}`}>
                      <svg viewBox="0 0 24 24" width="26" height="26" fill={preview.hex === "000000" ? "currentColor" : `#${preview.hex}`} aria-hidden>
                        <path d={preview.path} />
                      </svg>
                    </span>
                  ) : (
                    <span className="podium-tile podium-open flex size-13 items-center justify-center rounded-[14px]">
                      <Icon name="plus" width={18} strokeWidth={2.25} />
                    </span>
                  )}
                </span>
                <span className="podium-name">{entry?.name ?? preview?.title ?? "Your logo"}</span>
                <span className="podium-meta">{entry ? `${formatCount(entry.clicks)} clicks` : "Example"}</span>
              </div>
              <div className="podium-step" style={{ height: step.height, backgroundColor: step.tone, color: step.ink, animationDelay: `${step.delay}ms` }}>
                <span className="mono">{step.rank}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {live ? (
        <Link href="/leaderboard" className="text-primary mx-auto mt-4 flex w-fit items-center gap-1 text-xs font-semibold hover:underline">
          Full leaderboard <Icon name="arrow" width="12" height="12" />
        </Link>
      ) : (
        <p className="text-subtle mt-4 text-center text-xs">
          <span className="num text-foreground font-semibold">
            {filled}/{capacity}
          </span>{" "}
          filled · real ranking starts at {capacity}
        </p>
      )}
    </div>
  );
}
