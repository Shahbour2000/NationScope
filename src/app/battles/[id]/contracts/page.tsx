import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { getDisplay } from "@/features/entities/display.server";
import { BattleContractsView } from "@/features/wars/BattleContractsView";
import { getLocale, getMessages } from "@/i18n";
import { getBattleContracts } from "@/lib/data/battle-contracts";
import { getBattleDetail } from "@/lib/data/world";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function BattleContractsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const t = m.battleContracts;
  const [co, bt] = await Promise.allSettled([getBattleContracts(id), getBattleDetail(id)]);
  const head = <div className="page-head"><h1><Icon name="contract" size={26} />{t.title}</h1></div>;
  if (co.status === "rejected") return <>{head}<ApiErrorState error={co.reason} retryLabel={m.common.retry} /></>;
  if (!co.value.shapeOk) return <>{head}<StateMessage tone="empty" title={t.none} detail={m.regionPage.notRecognised} /></>;
  const d = await getDisplay();
  const battle = bt.status === "fulfilled" ? bt.value.battle : null;
  return (
    <>
      {head}
      <BattleContractsView battleId={id} contracts={co.value} battle={battle} d={d} m={m} />
      <Provenance meta={co.value.meta} m={m} />
    </>
  );
}
