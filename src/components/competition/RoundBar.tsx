import { LiveBadge } from "@/components/ui/Chip";
import { Countdown } from "@/components/ui/Countdown";
import type { Round, Season } from "@/generated/prisma";
import { formatCount } from "@/lib/format";

/**
 * The state of play, in one line: which round, how long is left, how many are
 * competing, and how many go out when the clock reaches zero.
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
  return (
    <div className="bg-surface shadow-tile flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl px-4 py-4 sm:rounded-full sm:px-5 sm:py-3">
      <div className="flex items-center gap-2">
        {round?.status === "ACTIVE" ? (
          <LiveBadge label={round.name} />
        ) : (
          <span className="label label-bright">{round?.name ?? `Season ${season.number}`}</span>
        )}
      </div>

      <div className="bg-border hidden h-4 w-px sm:block" aria-hidden />

      <div className="flex items-baseline gap-2">
        <span className="label">Competing</span>
        <span className="num text-sm font-semibold">{formatCount(competing)}</span>
      </div>

      {round ? (
        <>
          <div className="bg-border hidden h-4 w-px sm:block" aria-hidden />
          <div className="flex items-baseline gap-2">
            <span className="label">Eliminated at zero</span>
            <span className="num text-danger text-sm font-semibold">
              {formatCount(round.eliminationCount)}
            </span>
          </div>

          <div className="flex w-full flex-wrap items-baseline gap-2 sm:ml-auto sm:w-auto">
            <span className="label">
              {round.status === "ACTIVE" ? "Round ends in" : "Round closed"}
            </span>
            {round.status === "ACTIVE" ? (
              <Countdown
                endsAt={round.endAt.toISOString()}
                serverNow={serverNow}
                size="sm"
                className="text-sm"
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
