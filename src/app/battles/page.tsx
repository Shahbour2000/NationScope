import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { BattlesBoard } from "@/features/wars/BattlesBoard";
import { getLocale, getMessages } from "@/i18n";
import { getBattles } from "@/lib/data/world";

export const dynamic = "force-dynamic";

export default async function BattlesPage() {
  const m = getMessages(await getLocale());
  let res;
  try { res = await getBattles(); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  return (
    <>
      <div className="page-head"><h1><Icon name="battle" size={26} />{m.battlesPage.title}</h1></div>
      <p className="lede">{m.battlesPage.intro}</p>
      <BattlesBoard rows={res.rows} d={d} m={m.battlesPage} nowMs={Date.now()} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
