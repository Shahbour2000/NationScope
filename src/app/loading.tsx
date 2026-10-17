import { Logo } from "@/components/Logo";
import { getLocale, getMessages } from "@/i18n";

/** Branded route-transition loader. Indeterminate by design: real progress is not measurable here. */
export default async function Loading() {
  const m = getMessages(await getLocale());
  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot-ring" aria-hidden="true"><Logo showWordmark={false} /></div>
      <p>{m.shell.loading}…</p>
    </div>
  );
}
