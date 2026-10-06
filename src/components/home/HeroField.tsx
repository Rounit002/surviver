"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's ground: a flat dot grid that answers the cursor.
 *
 * Dots near the pointer step aside and take the brand blue, and they keep a
 * little of that "heat" for a moment, so moving the mouse leaves a short trail.
 * A click sends a ring outward through the grid. Everything is flat colour on
 * a canvas — no gradients, no glow.
 *
 * It listens on the hero section and never takes pointer events itself. The
 * frame loop runs only while something is moving, so an idle hero costs
 * nothing, and reduced motion gets the still grid.
 */
const GAP = 26;
const DOT = 1.1;
const REACH = 130;
const PUSH = 12;

type Ripple = { x: number; y: number; born: number };

export function HeroField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const hero = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !hero || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let heat = new Float32Array(0);
    let pointer: { x: number; y: number } | null = null;
    // Heat is only added on frames after the pointer moved, so a resting
    // cursor lets the trail cool and the loop stop.
    let fresh = false;
    const ripples: Ripple[] = [];
    let frame = 0;
    let ink = "";
    let hot = "";

    const readColors = () => {
      const style = getComputedStyle(document.documentElement);
      ink = style.getPropertyValue("--color-border-strong").trim() || "#d6d1c9";
      hot = style.getPropertyValue("--color-primary").trim() || "#3b76e1";
    };

    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = box.width;
      height = box.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cols = Math.ceil(width / GAP) + 1;
      rows = Math.ceil(height / GAP) + 1;
      heat = new Float32Array(cols * rows);
      draw(performance.now());
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const offsetX = (width % GAP) / 2;
      let moving = false;
      const heating = fresh;
      fresh = false;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const x0 = offsetX + c * GAP;
          const y0 = r * GAP + GAP / 2;
          let dx = 0;
          let dy = 0;
          let near = 0;

          if (pointer) {
            const vx = x0 - pointer.x;
            const vy = y0 - pointer.y;
            const d = Math.hypot(vx, vy);
            if (d < REACH && d > 0.01) {
              const f = 1 - d / REACH;
              dx += (vx / d) * f * f * PUSH;
              dy += (vy / d) * f * f * PUSH;
              near = f * 0.8;
              if (heating) heat[i] = Math.max(heat[i], f);
            }
          }

          for (const ripple of ripples) {
            const radius = (now - ripple.born) * 0.45;
            const vx = x0 - ripple.x;
            const vy = y0 - ripple.y;
            const d = Math.hypot(vx, vy);
            const band = 1 - Math.abs(d - radius) / 34;
            if (band > 0 && d > 0.01) {
              const fade = Math.max(0, 1 - radius / 520);
              dx += (vx / d) * band * fade * 9;
              dy += (vy / d) * band * fade * 9;
              heat[i] = Math.max(heat[i], band * fade * 0.9);
            }
          }

          if (heat[i] > 0.01) {
            moving = true;
            heat[i] *= 0.94;
          } else heat[i] = 0;
          const h = Math.max(heat[i], near);
          if (h > 0.01) {
            ctx.globalAlpha = 0.35 + h * 0.65;
            ctx.fillStyle = hot;
            ctx.beginPath();
            ctx.arc(x0 + dx, y0 + dy, DOT + h * 1.6, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = ink;
            ctx.fillRect(x0 + dx - DOT, y0 + dy - DOT, DOT * 2, DOT * 2);
          }
        }
      }
      ctx.globalAlpha = 1;

      for (let k = ripples.length - 1; k >= 0; k--) {
        if ((now - ripples[k].born) * 0.45 > 560) ripples.splice(k, 1);
      }
      return moving || ripples.length > 0;
    };

    const tick = (now: number) => {
      frame = draw(now) ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (!frame && !still) frame = requestAnimationFrame(tick);
    };

    const local = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const move = (event: PointerEvent) => {
      pointer = local(event);
      fresh = true;
      wake();
    };
    const leave = () => {
      pointer = null;
      wake();
    };
    const down = (event: PointerEvent) => {
      ripples.push({ ...local(event), born: performance.now() });
      wake();
    };

    readColors();
    resize();
    const sizer = new ResizeObserver(resize);
    sizer.observe(canvas);
    // The theme toggle swaps tokens on <html>; repaint in the new colours.
    const theme = new MutationObserver(() => {
      readColors();
      draw(performance.now());
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    if (!still) {
      hero.addEventListener("pointermove", move);
      hero.addEventListener("pointerleave", leave);
      hero.addEventListener("pointerdown", down);
    }

    return () => {
      cancelAnimationFrame(frame);
      sizer.disconnect();
      theme.disconnect();
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
      hero.removeEventListener("pointerdown", down);
    };
  }, []);

  return <canvas ref={ref} className="hero-field" aria-hidden />;
}
