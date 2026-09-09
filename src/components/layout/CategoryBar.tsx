"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Icon } from "@/components/ui/Icon";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_VALUES,
} from "@/lib/competition/constants";

/**
 * The category strip, after outbid.lol: a single rounded-full rail holding
 * horizontally scrollable chips, with the active one filled. It sits in the
 * header so category is a global filter rather than something buried on one
 * page.
 */
export function CategoryBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("category");

  // Filtering only means anything on the board.
  const hrefFor = (category: string | null) =>
    category ? `/board?category=${category}` : "/board";

  const chip =
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full " +
    "min-h-9 px-2.5 py-1 text-[13px] whitespace-nowrap transition-colors";

  const isBoard = pathname === "/board" || pathname === "/";

  return (
    <div className="bg-muted relative z-20 overflow-hidden rounded-full px-1.5 py-1.5">
      <div className="flex items-center gap-1">
        <nav
          aria-label="Browse by category"
          className={cn(
            "min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // Padding rather than a fade mask: the palette is flat fills only,
            // so the rail ends on a gap instead of a gradient.
            "pr-2",
          )}
        >
          <div className="flex w-max min-w-full items-center gap-0.5">
            <Link
              href={hrefFor(null)}
              aria-current={isBoard && !active ? "page" : undefined}
              className={cn(
                chip,
                isBoard && !active
                  ? "bg-primary text-white font-medium"
                  : "text-subtle hover:text-foreground",
              )}
            >
              <Icon name="grid" width="14" height="14" className="shrink-0" />
              All
            </Link>

            {CATEGORY_VALUES.map((category) => {
              const current = isBoard && active === category;
              return (
                <Link
                  key={category}
                  href={hrefFor(category)}
                  aria-current={current ? "page" : undefined}
                  // Each chip carries its own pastel. Selecting one deepens the
                  // ink and adds a ring rather than changing hue, so the active
                  // state reads without the rail changing colour under you.
                  className={cn(
                    chip,
                    "font-medium",
                    current ? "bg-primary text-white" : "text-subtle hover:bg-surface hover:text-foreground",
                  )}
                >
                  {/* The mark carries the category's own ink, the same colour
                      the board and the leaderboard use for it. On the filled
                      chip it drops back to the label colour so it stays
                      legible on coral. */}
                  <CategoryIcon
                    category={category}
                    className="shrink-0"
                    style={current ? undefined : { color: CATEGORY_COLORS[category].ink }}
                  />
                  {CATEGORY_LABELS[category]}
                </Link>
              );
            })}
          </div>
        </nav>

        <Link
          href="/enter"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
        >
          Enter
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
