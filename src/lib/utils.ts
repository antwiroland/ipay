import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Convert lean Mongo docs (ObjectId, Date) into plain JSON for client components. */
export function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** Pick the product image for a colour (seeded and admin images use "<model> in <colour>" alt text). */
export function imageForColour<T extends { alt?: string }>(images: T[], colour: string): T | undefined {
  const suffix = ` in ${colour}`.toLowerCase();
  return (colour && images.find((i) => i.alt?.toLowerCase().endsWith(suffix))) || images[0];
}
