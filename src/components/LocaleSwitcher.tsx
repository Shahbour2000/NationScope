import { setLocale } from "@/app/actions";
import type { Locale } from "@/i18n/messages";

/** Server-action form: works without client JS. */
export function LocaleSwitcher({ current, label, otherLabel }: { current: Locale; label: string; otherLabel: string }) {
  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={current === "ar" ? "en" : "ar"} />
      <button type="submit" className="btn-ghost" aria-label={label} lang={current === "ar" ? "en" : "ar"}>
        {otherLabel}
      </button>
    </form>
  );
}
