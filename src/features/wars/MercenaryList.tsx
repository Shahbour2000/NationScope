import Link from "next/link";
import type { Display } from "@/features/entities/display";
import { Dt, Money, PlayerChip, StatusBadge } from "@/features/entities/entities";
import { DataView } from "@/features/explorer/DataView";
import type { Messages } from "@/i18n/messages";
import { readMercenaryEntry } from "@/lib/domain/contracts";
import s from "../regions/region.module.css";

/** A titled list of mercenary auctions/contracts: a card with the recognised fields and the full entry under "Details". Renders nothing for an empty list. */
export function MercenaryList({ title, items, d, m }: { title: string; items: unknown[]; d: Display; m: Messages }) {
  if (items.length === 0) return null;
  const t = m.mercenary, nf = new Intl.NumberFormat(d.nl);
  return (
    <section>
      <h2 className={s.sec}>{title} · {nf.format(items.length)}</h2>
      <p className={s.dim}>{t.note}</p>
      <ul className={s.cards}>
        {items.map((x, i) => {
          const e = readMercenaryEntry(x);
          return (
            <li key={e.id ?? i} className={s.card}>
              {e.recognised ? (
                <>
                  <div className={s.cardHead}>
                    {e.side ? <span className={s.badge} data-tone={e.side === "attacker" ? "warn" : "ok"}>{e.side === "attacker" ? t.sideAttacker : e.side === "defender" ? t.sideDefender : e.side}</span> : <span />}
                    {e.status ? <StatusBadge value={e.status} d={d} /> : null}
                  </div>
                  <dl className={s.facts}>
                    {e.perK ? <><dt>{t.price}</dt><dd><Money value={e.perK} d={d} /></dd></> : null}
                    {e.maxPerK ? <><dt>{t.maxPrice}</dt><dd><Money value={e.maxPerK} d={d} /></dd></> : null}
                    {e.damageTarget != null ? <><dt>{t.target}</dt><dd>{nf.format(e.damageTarget)}</dd></> : null}
                    {e.damageDone != null ? <><dt>{t.done}</dt><dd>{nf.format(e.damageDone)}</dd></> : null}
                    {e.bidCount != null ? <><dt>{t.bids}</dt><dd>{nf.format(e.bidCount)}</dd></> : null}
                    {e.endsAt ? <><dt>{t.ends}</dt><dd><Dt iso={e.endsAt} d={d} /></dd></> : null}
                    {e.who ? <><dt>{t.by}</dt><dd>{e.who.id ? <PlayerChip id={e.who.id} name={e.who.name} avatar={null} d={d} /> : e.who.name}</dd></> : null}
                  </dl>
                  {e.battleId && /^[A-Za-z0-9_-]{1,80}$/.test(e.battleId) ? <Link href={`/battles/${encodeURIComponent(e.battleId)}`}>{t.openBattle}</Link> : null}
                </>
              ) : null}
              <details><summary>{t.details}</summary><DataView data={x} section={null} detailLinks={false} labels={m.explorer} d={d} /></details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
