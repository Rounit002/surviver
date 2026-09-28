"use client";

import { useEffect, useRef } from "react";

/**
 * A soft light that follows the pointer across the hero and lights up the dot
 * grid underneath it. Purely decorative: it listens on the hero section, never
 * takes pointer events itself, and is skipped on touch screens and for people
 * who asked for reduced motion.
 */
export function HeroGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = ref.current;
    const hero = layer?.parentElement;
    if (!layer || !hero) return;
    if (!window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;

    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = hero.getBoundingClientRect();
        layer.style.setProperty("--mx", `${event.clientX - box.left}px`);
        layer.style.setProperty("--my", `${event.clientY - box.top}px`);
        layer.dataset.on = "";
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      delete layer.dataset.on;
    };

    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <div ref={ref} className="hero-glow" aria-hidden />;
}
