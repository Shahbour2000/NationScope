import { cookies } from "next/headers";
import { LOCALES, MESSAGES, type Locale, type Messages } from "./messages";

export const LOCALE_COOKIE = "ns_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "en";
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Data digits stay Latin in every locale so figures are unambiguous. */
export function numberLocale(locale: Locale): string {
  return locale === "ar" ? "ar-u-nu-latn" : "en-US";
}
