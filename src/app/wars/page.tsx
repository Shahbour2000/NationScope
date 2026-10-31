import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { WarsBoard } from "@/features/wars/WarsBoard";
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
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.4rem", maxInlineSize: "62rem" }}>{m.warsPage.intro}</p>
      <WarsBoard rows={res.rows} d={d} m={m.warsPage} nowMs={Date.now()} />
      {res.skipped > 0 && <p className="banner" role="status">{res.skipped} {m.units.skipped}</p>}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
