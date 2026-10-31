import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { WarsTable } from "@/features/wars/WarsTable";
import { getLocale, getMessages } from "@/i18n";
import { getWars } from "@/lib/data/world";

export const dynamic = "force-dynamic";

export default async function WarsPage() {
  const m = getMessages(await getLocale());
  let res;
  try { res = await getWars(); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  return (
    <>
      <div className="page-head"><h1><Icon name="war" size={26} />{m.warsPage.title}</h1></div>
      <p className="note">{m.warsPage.intro}</p>
      <ol className="howto" aria-label={m.warsPage.howTitle}>
        {([["how1", "how1d"], ["how2", "how2d"], ["how3", "how3d"]] as const).map(([t, t2], i) => (
          <li key={t}><span className="howto-n">{i + 1}</span><div><b>{m.warsPage[t]}</b><p>{m.warsPage[t2]}</p></div></li>
        ))}
      </ol>
      <WarsTable rows={res.rows} d={d} m={m.warsPage} nowMs={Date.now()} />
      {res.skipped > 0 && <p className="banner" role="status">{res.skipped} {m.units.skipped}</p>}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
