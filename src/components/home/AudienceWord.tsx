"use client";

import { useEffect, useState } from "react";

/** Who the 400K monthly views come from, one word at a time. */
const WORDS = ["developers", "founders", "students", "AI builders"] as const;

export function AudienceWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % WORDS.length), 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="audience-word">
      {/* Screen readers hear the whole list once instead of a word that keeps changing. */}
      <span className="sr-only">{WORDS.join(", ")}</span>
      <span key={WORDS[index]} className="audience-word-current" aria-hidden>
        {WORDS[index]}
      </span>
    </span>
  );
}
