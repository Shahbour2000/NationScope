import Link from "next/link";
import { Money, Flag, StatusBadge } from "@/features/entities/entities";
import { countryName, type Display } from "@/features/entities/display";
import { DataView } from "@/features/explorer/DataView";
import { MercenaryList } from "./MercenaryList";
import type { Messages } from "@/i18n/messages";
import { bountyOpen, bountyTotals, sortBounties, type BattleContracts } from "@/lib/domain/contracts";
import { BountyCard, type BattleContext } from "./BountyCard";
import s from "./contracts.module.css";

const hasValue = (v: unknown) => v !== null && v !== undefined && !(typeof v === "object" && Object.keys(v as object).length === 0);

/** Body of /battles/{id}/contracts. `battle` is the battle's own detail (for side names); null when it could not be loaded. */
export function BattleContractsView({ battleId, contracts, battle, d, m }: { battleId: string; contracts: BattleContracts; battle: (BattleContext & { status?: string | null }) | null; d: Display; m: Messages }) {
  const t = m.battleContracts, ct = m.contractsPage, nf = new Intl.NumberFormat(d.nl);
  const sorted = sortBounties(contracts.bounties);
  const open = sorted.filter(bountyOpen), closed = sorted.filter((b) => !bountyOpen(b));
  const tot = bountyTotals(contracts.bounties);
  const ctx: BattleContext | null = battle ? { ...battle, id: battleId } : null;
  const empty = open.length === 0 && closed.length === 0 && contracts.auctions.length === 0 && !hasValue(contracts.myContract);
  const side = (id: string | null | undefined) => id ? <span className={s.mini}><Flag id={id} d={d} /><b dir="auto">{countryName(id, d.dir)}</b></span> : <span>—</span>;
  return (
    <>
      <p className={s.lead}>{t.intro}</p>
      {battle ? (
        <div className={`panel ${s.battleBar}`}>
          {side(battle.attackerCountryId)}<span className={s.vs}>VS</span>{side(battle.defenderCountryId)}
          {battle.type ? <StatusBadge value={battle.type} d={d} group="battleType" /> : null}
          {battle.status ? <StatusBadge value={battle.status} d={d} /> : null}
        </div>
      ) : <p className={s.rules}>{t.unavailable}</p>}
      <p className={s.rules}>
        <Link href={`/battles/${encodeURIComponent(battleId)}`}>{t.back}</Link>
        <Link href="/contracts">{t.allContracts}</Link>
      </p>

      {contracts.enabled === false ? <p className={s.empty}>{t.disabled}</p> : empty ? <p className={s.empty}>{t.none}</p> : (
        <>
          {open.length > 0 ? (
            <div className={s.kpis}>
              <div><b>{nf.format(tot.open)}</b><span>{t.offers}</span></div>
              <div><b><Money value={tot.pool.toString()} d={d} /></b><span>{t.totalLeft}</span></div>
              {tot.best !== null ? <div><b><Money value={tot.best.toString()} d={d} /></b><span>{t.bestPay}</span></div> : null}
            </div>
          ) : null}
          {open.length > 0 ? <><h2 className={s.h2}>{t.bounties}</h2><div className={s.grid}>{open.map((b) => <BountyCard key={b.id} b={b} d={d} t={ct} context={ctx} linkToBattle={false} />)}</div></> : null}
          {closed.length > 0 ? (
            <details className={s.more}><summary>{t.inactive.replace("{n}", nf.format(closed.length))} · {t.showInactive}</summary>
              <div className={s.grid} style={{ marginBlockStart: "0.8rem" }}>{closed.map((b) => <BountyCard key={b.id} b={b} d={d} t={ct} context={ctx} linkToBattle={false} />)}</div>
            </details>
          ) : null}
          <MercenaryList title={t.auctions} items={contracts.auctions} d={d} m={m} />
          {hasValue(contracts.myContract) ? <><h2 className={s.h2}>{t.myContract}</h2><p className={s.rules}>{t.myNote}</p><DataView data={contracts.myContract} section={null} detailLinks={false} labels={m.explorer} d={d} /></> : null}
        </>
      )}
      {contracts.skipped > 0 ? <p className={s.rules}>{m.regionPage.c.skipped.replace("{n}", nf.format(contracts.skipped))}</p> : null}
    </>
  );
}
