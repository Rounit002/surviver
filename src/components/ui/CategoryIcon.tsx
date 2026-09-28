import {
  BarChart3,
  Clapperboard,
  Code2,
  Layers,
  Lightbulb,
  ListChecks,
  Megaphone,
  PenTool,
  Sparkles,
  Zap,
  type LucideProps,
} from "lucide-react";
import type { ProductCategory } from "@/generated/prisma";

/**
 * A mark per category, from the same Lucide set as `Icon`, so the category
 * rail and the rest of the interface read as one family.
 */
const ICONS: Record<ProductCategory, typeof Sparkles> = {
  AI: Sparkles,
  DEV_TOOLS: Code2,
  PRODUCTIVITY: ListChecks,
  MARKETING: Megaphone,
  DESIGN: PenTool,
  FOUNDER_TOOLS: Lightbulb,
  AUTOMATION: Zap,
  NO_CODE: Layers,
  ANALYTICS: BarChart3,
  CREATOR: Clapperboard,
};

export function CategoryIcon({ category, width = 15, height = 15, ...props }: Omit<LucideProps, "ref"> & { category: ProductCategory }) {
  const Component = ICONS[category];
  return <Component width={width} height={height} strokeWidth={2} aria-hidden="true" {...props} />;
}
