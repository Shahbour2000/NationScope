import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { DataView } from "@/features/explorer/DataView";
import { GameRulesView } from "@/features/game/GameRulesView";
import { getLocale, getMessages } from "@/i18n";
import { getGameRules } from "@/lib/data/game-rules";

export const dynamic = "force-dynamic";

export default async function GamePage() {
  const m = getMessages(await getLocale());
  const t = m.gamePage;
  const head = <div className="page-head"><h1><Icon name="shield" size={26} />{t.title}</h1></div>;
  let res;
  try { res = await getGameRules(); } catch (e) { return <>{head}<ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  return (
    <>
      {head}
      <p className="note">{t.intro}</p>
      {res.rules ? <GameRulesView rules={res.rules} d={d} m={m} /> : <><p className="res-note">{t.unrecognised}</p><DataView data={res.raw} section={null} detailLinks={false} labels={m.explorer} d={d} /></>}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
