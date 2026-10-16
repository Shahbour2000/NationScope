"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n";

export async function setLocale(formData: FormData): Promise<void> {
  const value = formData.get("locale");
  const locale = isLocale(value) ? value : "en";
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
}
