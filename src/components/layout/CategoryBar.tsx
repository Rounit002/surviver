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
 * The category filter: a scrollable row of chips over a hairline.
 *
 * It used to sit in the site header, which made it a fixture on pages that
 * have nothing to filter. It now sits with the board it filters, on the home
 * page and on `/board` — a control next to the thing it controls, rather than
 * a permanent strip under the navigation.
 *
 * The active chip inverts to the ink rather than filling with the accent. The
 * accent belongs to the one real action on a page, and a filter is not it.
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
    "min-h-8.5 px-3.5 py-1 text-[13px] font-medium whitespace-nowrap " +
    "transition-all duration-150";

  const isBoard = pathname === "/board" || pathname === "/";

  return (
    <div className="border-border/80 relative border-b pb-3">
      <div className="flex items-center gap-1">
        <nav
          aria-label="Browse by category"
          className={cn(
            "min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "pr-2",
          )}
        >
          <div className="flex w-max min-w-full items-center gap-1.5">
            <Link
              href={hrefFor(null)}
              aria-current={isBoard && !active ? "page" : undefined}
              className={cn(
                chip,
                isBoard && !active
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-subtle hover:bg-muted/80 hover:text-foreground border border-border/50",
              )}
            >
              <Icon name="grid" width="13" height="13" className="shrink-0" />
              All
            </Link>

            {CATEGORY_VALUES.map((category) => {
              const current = isBoard && active === category;
              return (
                <Link
                  key={category}
                  href={hrefFor(category)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    chip,
                    current
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "text-subtle hover:bg-muted/80 hover:text-foreground border border-border/50",
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

      </div>
    </div>
  );
}
