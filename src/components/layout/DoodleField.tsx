import type { CSSProperties, ReactElement } from "react";
import { Doodle } from "@/components/ui/Doodle";
import { Icon } from "@/components/ui/Icon";

/**
 * The wallpaper: small doodles printed faintly across a white page, so they
 * read as something pressed into the paper rather than as elements sitting on
 * top of it. How faint is `--doodle-ink` in `globals.css`, not here.
 *
 * Static by design — nothing here moves. It is a server component with no
 * client JavaScript, so the page pays for a little markup and nothing else,
 * and there is no animation for `prefers-reduced-motion` to have an opinion
 * about.
 *
 * ## How the scatter avoids looking scattered-by-a-computer
 *
 * A uniform random draw clumps: it reliably drops two marks on top of each
 * other and leaves holes elsewhere. A jittered grid does the opposite and
 * reads as a grid. So positions come from Mitchell's best-candidate sampling —
 * each mark is the roomiest of several random tries — which gives blue noise:
 * even spacing, no repeating structure, no alignment to find.
 *
 * Two properties of that algorithm are load-bearing here:
 *
 *  1. **Every prefix of the list is already well spread.** Marks land in the
 *     emptiest space available, so the first eighteen cover the page on their
 *     own. That is what the responsive tiers are built on: a phone renders a
 *     prefix rather than a random subset, and keeps the same open spacing.
 *  2. **Tries are scored against the page's own layout.** One in the middle
 *     column, where the content sits, has its score cut, so it only wins with
 *     a lot of room around it. The centre thins; the margins carry the
 *     decoration.
 *
 * Nothing is random at request time. The generator is seeded, so the layout is
 * identical on every render — which SSR requires, and which also stops the
 * background reshuffling under the reader on every navigation.
 */

/**
 * The mark pool: the playful end of the vocabulary, plus the two glyphs the
 * app already owns that belong in a doodle field. Deliberately no category
 * icons — this is decoration, and a page dusted with faint MARKETING
 * megaphones would be saying something it does not mean to say.
 *
 * Factories rather than elements: each is rendered as one mark's only child,
 * never as an array, and a bare array of elements only invites someone to map
 * over it later and lose the keys.
 */
const MARKS: Array<() => ReactElement> = [
  () => <Doodle name="star" />,
  () => <Doodle name="controller" />,
  () => <Doodle name="rocket" />,
  () => <Doodle name="smile" />,
  () => <Icon name="trophy" />,
  () => <Doodle name="heart" />,
  () => <Doodle name="bolt" />,
  () => <Doodle name="dice" />,
  () => <Doodle name="crown" />,
  () => <Doodle name="cursor" />,
  () => <Doodle name="squiggle" />,
  () => <Icon name="spark" />,
  () => <Doodle name="flag" />,
];

const HUES = ["blue", "coral", "violet", "teal", "amber", "pink"];

/** Total marks, and the counts a phone and a tablet stop at. */
const COUNT = 54;
const PHONE = 18;
const TABLET = 34;

/** Tries per mark. More tries means more even spacing and less randomness. */
const TRIES = 14;

/** Seeded, so the page renders the same scatter every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Placed = {
  x: number;
  y: number;
  scale: number;
  tilt: number;
  mark: number;
  hue: number;
};

function scatter(): Placed[] {
  const random = rng(0x5c4a7e11);
  const placed: Placed[] = [];

  for (let i = 0; i < COUNT; i++) {
    let best = { x: 0.5, y: 0.5 };
    let bestScore = -1;

    for (let t = 0; t < TRIES; t++) {
      const x = random();
      const y = random();

      // Room around this try: distance to the nearest mark already down.
      let nearest = 1;
      for (const p of placed) nearest = Math.min(nearest, Math.hypot(p.x - x, p.y - y));

      // How far out of the content column the try sits — 0 in the middle, 1 by
      // the margins. Scoring by it is what thins the centre: a middle try has
      // to beat an edge try by more than twice the clearance to win.
      const edge = Math.min(1, Math.abs(x - 0.5) * 2.4);
      const score = nearest * (0.42 + 0.58 * edge);

      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }

    placed.push({
      ...best,
      // Small, and varied enough that no two neighbours read as a pair.
      scale: 0.72 + random() * 0.66,
      // "Slightly": enough to look hand-placed, not enough to look knocked over.
      tilt: Math.round((random() * 2 - 1) * 22),
      // Ink is not varied per mark — every doodle shares one opacity, set once
      // in `globals.css` rather than repeated across 54 inline styles.
      mark: Math.floor(random() * MARKS.length),
      hue: Math.floor(random() * HUES.length),
    });
  }

  return placed;
}

/** Built once per process, not once per request. */
const PLACED = scatter();

export function DoodleField() {
  return (
    <div className="doodle-field" aria-hidden="true">
      {PLACED.map((m, i) => (
        <span
          key={i}
          className={`doodle ${i < PHONE ? "doodle--always" : i < TABLET ? "doodle--sm" : "doodle--lg"}`}
          style={{
            "--doodle-x": `${(m.x * 100).toFixed(2)}%`,
            "--doodle-y": `${(m.y * 100).toFixed(2)}%`,
            "--doodle-scale": m.scale.toFixed(2),
            "--doodle-tilt": `${m.tilt}deg`,
            color: `var(--color-doodle-${HUES[m.hue]})`,
          } as CSSProperties}
        >
          {MARKS[m.mark]()}
        </span>
      ))}
    </div>
  );
}
