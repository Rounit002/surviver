"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  return <div className="sm:hidden" onKeyDown={event => {
    if (event.key === "Escape") {
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-controls="mobile-navigation"
      className="border-border flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium"
      onClick={() => setOpen(!open)}>
      {open ? "Close" : "Menu"}
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d={open ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} />
      </svg>
    </button>
    {open && <nav id="mobile-navigation" aria-label="Mobile navigation"
      className="border-border bg-surface absolute top-full right-0 left-0 z-30 mt-2 grid grid-cols-2 gap-1 rounded-2xl border p-2 shadow-card">
      {[["/board", "Board"], ["/leaderboard", "Leaderboard"], ["/seasons", "Seasons"], ["/survivors", "Survivors"], ["/how-it-works", "How it works"], ["/dashboard", "Your campaigns"]].map(([href, label]) =>
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
          onClick={() => setOpen(false)}
          className="hover:bg-muted aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary flex min-h-11 items-center rounded-lg px-3 text-sm">
          {label}
        </Link>)}
    </nav>}
  </div>;
}
