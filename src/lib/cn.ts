type ClassValue = string | false | null | undefined;

/** Joins class names. Deliberately tiny: no merge logic, so order is explicit. */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
