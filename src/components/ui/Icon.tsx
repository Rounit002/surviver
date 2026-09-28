import {
  ArrowRight,
  BarChart3,
  Check,
  ExternalLink,
  Globe,
  LayoutGrid,
  Lock,
  MousePointerClick,
  Plus,
  Radio,
  Rocket,
  Sparkles,
  Trophy,
  Users,
  type LucideProps,
} from "lucide-react";

/**
 * Every interface icon on the site, from one library.
 *
 * Lucide (MIT): a single outline style on a strict 24px grid, which sits well
 * beside DM Sans. Keeping the names here — rather than importing Lucide at
 * each call site — means the whole site can change icon set in one file, and
 * only these icons ship in the bundle.
 */
const ICONS = {
  arrow: ArrowRight,
  globe: Globe,
  trophy: Trophy,
  spark: Sparkles,
  grid: LayoutGrid,
  users: Users,
  bars: BarChart3,
  lock: Lock,
  external: ExternalLink,
  plus: Plus,
  check: Check,
  click: MousePointerClick,
  rocket: Rocket,
  live: Radio,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, width = 20, height, strokeWidth = 2, ...props }: Omit<LucideProps, "ref"> & { name: IconName }) {
  const Component = ICONS[name];
  return <Component width={width} height={height ?? width} strokeWidth={strokeWidth} aria-hidden="true" {...props} />;
}
