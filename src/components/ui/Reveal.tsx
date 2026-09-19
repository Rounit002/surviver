"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The site's one entrance: content rises a little and fades in as it arrives.
 *
 * Deliberately the only reveal in the system. A page where every element has
 * its own idea about how to appear reads as a demo; one movement, reused, reads
 * as a product.
 *
 * ## The thing this has to get right
 *
 * `.reveal` starts at `opacity: 0`, so every path that leads to the class being
 * applied must also lead to it being removed. A missed animation is a small
 * bug; content that never appears is a blank page. Three guards, in order:
 *
 *  1. **No JavaScript, no hiding.** The class is added in an effect, so the
 *     server never sends hidden markup. A reader without JavaScript — or one
 *     whose bundle fails — sees the page exactly as if this component were not
 *     here.
 *  2. **No `IntersectionObserver`, no hiding.** Old browsers resolve
 *     immediately instead of waiting for an API they do not have.
 *  3. **A failsafe for anything already on screen.** If the observer exists but
 *     never reports — a background tab, an occluded window, an implementation
 *     quirk — anything within the viewport resolves on a timer anyway. This is
 *     not theoretical: it is exactly what happened the first time this shipped,
 *     with a hero that stayed invisible because the observer's first callback
 *     never came.
 *
 * Content below the fold is left to the observer, which is the one case where
 * staying hidden is the correct behaviour anyway.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
}: {
  /** The element to render. Use a real tag so the section keeps its semantics. */
  as?: ElementType;
  /** Stagger, in milliseconds. Keep the steps small — 60 to 90ms reads as one
   *  movement, where 200 reads as a queue. */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const show = () => node.classList.add("is-in");

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    // Only now does the element start hidden.
    node.classList.add("reveal");

    const failsafe = window.setTimeout(() => {
      if (node.getBoundingClientRect().top < window.innerHeight) show();
    }, 1200);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          window.clearTimeout(failsafe);
          show();
          // One-way: re-hiding on scroll-up is the thing that makes these
          // effects feel cheap.
          observer.unobserve(entry.target);
        }
      },
      // Start a little before the element is actually in view, so the motion
      // finishes about when the reader gets there rather than starting then.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    observer.observe(node);
    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn(className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
