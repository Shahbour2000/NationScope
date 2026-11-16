import Link from "next/link";
import { countryName, type Display } from "@/features/entities/display";
import { Flag, Money, RegionLink } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import { remainingPercent, type Bounty } from "@/lib/domain/contracts";
import s from "./contracts.module.css";

const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export interface BattleContext { id?: string | null; type?: string | null; regionId?: string | null; attackerCountryId?: string | null; defenderCountryId?: string | null }

function Side({ id, paid, label, d }: { id: string | null | undefined; paid: boolean; label: string; d: Display }) {
  return (
    <div className={s.side} data-paid={paid}>
      {id && <Flag id={id} d={d} />}
      <span className={s.name} dir="auto">{id ? countryName(id, d.dir) : "—"}</span>
      <span className={s.paid}>{paid ? label : ""}</span>
    </div>
  );
}

/** One bounty. Used by /contracts (battle comes from the bounty) and by a battle's own contracts page (`context` supplies the sides when the bounty has no `battle`). */
export function BountyCard({ b, d, t, context, linkToBattle = true }: { b: Bounty; d: Display; t: Messages["contractsPage"]; context?: BattleContext | null; linkToBattle?: boolean }) {
  const bt: BattleContext | null = b.battle ?? context ?? null;
  const pct = remainingPercent(b);
  const f = b.funder;
  const fname = f?.name ?? (f?.type === "country" && f.id ? countryName(f.id, d.dir) : null);
  return (
    <article className={s.card}>
      {linkToBattle && bt?.id && safe(bt.id) && <Link className={s.cover} href={`/battles/${encodeURIComponent(bt.id)}`} aria-label={fname ?? t.title} />}
      <div className={s.top}><b>{bt?.regionId ? <RegionLink id={bt.regionId} d={d} link={false} /> : ""}</b><span>{bt?.type ? (d.m.t.battleType as Record<string, string>)[bt.type] ?? bt.type : ""}</span></div>
      <div className={s.clash}>
        <Side id={bt?.attackerCountryId} paid={b.side === "attacker"} label={t.forSide} d={d} />
        <span className={s.vs}>VS</span>
        <Side id={bt?.defenderCountryId} paid={b.side === "defender"} label={t.forSideD} d={d} />
      </div>
      <div className={s.pay}><b><Money value={b.perK} d={d} /></b><span>{t.per1k}</span></div>
      {pct !== null && <div className={s.track} title={`${pct}%`}><i style={{ inlineSize: `${pct}%` }} /></div>}
      <div className={s.foot}>
        <span>{fname ? <>{t.fundedBy} <b dir="auto">{fname}</b></> : ""}</span>
        <span><b><Money value={b.remaining} d={d} /></b> {t.left}</span>
      </div>
    </article>
  );
}
export { s as contractStyles };
