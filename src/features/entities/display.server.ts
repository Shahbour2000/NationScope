import { getLocale, getMessages, numberLocale } from "@/i18n";
import { tryGetConfig } from "@/lib/config/env";
import { getCountries, toDirectory } from "@/lib/data/world";
import { EMPTY_DIRECTORY, type Directory } from "@/lib/domain/directory";
import type { Display } from "./display";

/** Server-only. Builds the display context; the country directory is one cached request and degrades to ids if it fails. */
export async function getDisplay(opts: { regionNames?: Record<string, string> } = {}): Promise<Display> {
  const locale = await getLocale();
  const m = getMessages(locale);
  let dir: Directory = EMPTY_DIRECTORY;
  try {
    dir = toDirectory((await getCountries()).countries);
  } catch {
    /* names fall back to ids; pages still render */
  }
  if (opts.regionNames) dir = { ...dir, regionNames: { ...dir.regionNames, ...opts.regionNames } };
  return {
    locale, nl: numberLocale(locale), mediaOrigin: tryGetConfig()?.origin ?? "",
    dir, m: { t: m.t, items: m.items, time: m.time, ui: m.ui },
  };
}
