"use client";

import { StateMessage } from "@/components/StateMessage";

/** Two languages inline on purpose: this client boundary must not pull the whole message bundle. tests/errors-i18n.test.ts keeps it equal to `messages.errors.boundary`. */
export const BOUNDARY_TEXT = {
  en: { title: "Something went wrong", detail: "An unexpected error occurred while loading this page.", retry: "Try again" },
  ar: { title: "حدث خطأ ما", detail: "وقع خطأ غير متوقع أثناء تحميل هذه الصفحة.", retry: "حاول مرة أخرى" },
} as const;

/** Last-resort boundary for unexpected render errors. Expected API errors are handled in pages. */
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = typeof document !== "undefined" && document.documentElement.lang === "ar" ? "ar" : "en";
  const x = BOUNDARY_TEXT[lang];
  return <StateMessage tone="error" title={x.title} detail={x.detail} action={<button type="button" className="btn" onClick={reset}>{x.retry}</button>} />;
}
