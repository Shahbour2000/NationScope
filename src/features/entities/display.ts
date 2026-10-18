import type { Directory } from "@/lib/domain/directory";
import { countryName, schemeColor } from "@/lib/domain/directory";
import { humanizeCode } from "@/lib/format";
import type { Locale, Messages } from "@/i18n/messages";

/** Everything a component needs to render entities. Plain data, safe to pass to client components. */
export interface Display {
  locale: Locale;
  /** Intl locale for numbers/dates (Latin digits in Arabic). */
  nl: string;
  mediaOrigin: string;
  dir: Directory;
  m: Pick<Messages, "t" | "items" | "time" | "ui">;
}

export function term(group: keyof Messages["t"], value: string | null | undefined, d: Display): string {
  if (!value) return d.m.ui.missing;
  return (d.m.t[group] as Record<string, string>)[value] ?? humanizeCode(value);
}

const GEAR = /^(helmet|chest|pants|boots|gloves)(\d+)$/;

/** Localized item name. Known codes use the dictionary; gear codes read "Helmet 3"; anything else is humanized. */
export function itemName(code: string, d: Display): string {
  const known = (d.m.items as Record<string, string>)[code];
  if (known) return known;
  const g = GEAR.exec(code);
  if (g) return `${term("slot", g[1], d)} ${g[2]}`;
  return humanizeCode(code);
}

export { countryName, schemeColor };
