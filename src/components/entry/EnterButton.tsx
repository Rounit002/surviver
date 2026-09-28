"use client";

import type { ComponentProps } from "react";
import { openEntry } from "./entry-bus";

/**
 * A link to /enter that opens the entry dialog in place instead.
 *
 * It stays a real link, so it still works before hydration, with JavaScript
 * off, or opened in a new tab — but a normal click never leaves the page.
 */
export function EnterButton({ onClick, ...props }: ComponentProps<"a">) {
  return (
    <a
      href="/enter"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        openEntry();
      }}
    />
  );
}
