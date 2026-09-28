import { LiveBadge } from "@/components/ui/Chip";
import { Countdown } from "@/components/ui/Countdown";
import type { Round, Season } from "@/generated/prisma";
import { formatCount } from "@/lib/format";

/**
 * The state of play, in one line: live or not, how many products are on the
 * board, and how long the season's ranking window has left.
 */
export function RoundBar({
  season,
  round,
  competing,
  serverNow,
}: {
  season: Season;
  round: Round | null;
  competing: number;
  serverNow: string;
}) {
  const live = round?.status === "ACTIVE";
  return (
    <div className="bg-surface border-border flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[16px] border px-4 py-3 sm:px-5">
      {live ? <LiveBadge label={`${season.name} · Live`} /> : <span className="label label-bright">{season.name}</span>}

      <div className="flex items-baseline gap-2">
        <span className="label">On the board</span>
        <span className="num text-sm font-semibold">{formatCount(competing)}</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="label">Ranked by</span>
        <span className="text-sm font-semibold">Clicks</span>
      </div>

      {round ? (
        <div className="flex w-full flex-wrap items-baseline gap-2 sm:ml-auto sm:w-auto">
          <span className="label">{live ? "Season ends in" : "Season closed"}</span>
          {live ? <Countdown endsAt={round.endAt.toISOString()} serverNow={serverNow} size="sm" className="text-sm" /> : null}
        </div>
      ) : null}
    </div>
  );
}
