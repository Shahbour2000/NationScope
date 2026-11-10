import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { RARITY_ORDER, SLOT_ORDER } from "@/features/economy/analytics";
import { floorGroups, isKnownRarity, rarityRank } from "@/features/economy/floor";
import { term } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { ItemIcon, Money } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getEquipmentFloor, getEquipmentOffers } from "@/lib/data/economy";
import type { EquipmentOffer } from "@/lib/domain/economy";
import { humanizeCode } from "@/lib/format";
import s from "./floor.module.css";

export const dynamic = "force-dynamic";

/** The cheapest live offer of each priced slot/rarity (the floor endpoint has no item code, so the icon and stats come from it). A failed lookup just drops the icon. */
async function cheapestOffers(keys: { slot: string; rarity: string }[]): Promise<Map<string, EquipmentOffer>> {
  const out = new Map<string, EquipmentOffer>();
  for (let i = 0; i < keys.length; i += 6) {
    const batch = keys.slice(i, i + 6);
    const res = await Promise.allSettled(batch.map((k) => getEquipmentOffers({ slot: k.slot, rarity: k.rarity, sort: "priceAsc", limit: 1 })));
    res.forEach((r, j) => { const k = batch[j]!; const o = r.status === "fulfilled" ? r.value.rows[0] : undefined; if (o) out.set(`${k.slot}|${k.rarity}`, o); });
  }
  return out;
}

export default async function FloorPage({ searchParams }: { searchParams: Promise<{ slot?: string; rarity?: string }> }) {
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const e = m.economyPage;
  let res;
  try { res = await getEquipmentFloor(); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const allSlots = [...SLOT_ORDER.filter((x) => res.rows.some((r) => r.slot === x)), ...[...new Set(res.rows.map((r) => r.slot))].filter((x) => !SLOT_ORDER.includes(x))];
  const allRarities = [...RARITY_ORDER.filter((x) => res.rows.some((r) => r.rarity === x)), ...[...new Set(res.rows.map((r) => r.rarity))].filter((x) => !isKnownRarity(x))];
  const slot = sp.slot && allSlots.includes(sp.slot) ? sp.slot : undefined;
  const rarity = sp.rarity && allRarities.includes(sp.rarity) ? sp.rarity : undefined;
  const groups = floorGroups(res.rows, { slot, rarity });
  const priced = groups.flatMap((g) => g.cells.filter((c): c is Exclude<typeof c, { empty: true }> => !("empty" in c)));
  const offers = await cheapestOffers(priced.map((c) => ({ slot: c.slot, rarity: c.rarity })));
  const nf = new Intl.NumberFormat(d.nl);
  const href = (o: { slot?: string | undefined; rarity?: string | undefined }) => {
    const q = new URLSearchParams();
    if (o.slot) q.set("slot", o.slot);
    if (o.rarity) q.set("rarity", o.rarity);
    const t = q.toString();
    return t ? `/equipment-floor?${t}` : "/equipment-floor";
  };
  const tierPips = (r: string) => { const k = rarityRank(r); return k < 0 ? null : <span className={s.pips} role="img" aria-label={`${e.floorTier} ${k + 1} / ${RARITY_ORDER.length}`}>{RARITY_ORDER.map((_, i) => <i key={i} data-on={i <= k} />)}</span>; };
  return (
    <>
      <div className="page-head"><h1><Icon name="box" size={26} />{e.floorTitle}</h1></div>
      <p className="note">{e.floorNote} <Link href="/equipment">{e.cheapestOffers}</Link></p>
      <div className={s.filters}>
        <div className={s.fgroup} role="group" aria-label={e.slot}>
          <Link className={s.chip} href={href({ rarity })} aria-current={!slot}>{e.floorAllSlots}</Link>
          {allSlots.map((x) => <Link key={x} className={s.chip} href={href({ slot: x, rarity })} aria-current={slot === x}>{term("slot", x, d)}</Link>)}
        </div>
        <div className={s.fgroup} role="group" aria-label={e.rarity}>
          <Link className={s.chip} href={href({ slot })} aria-current={!rarity}>{e.floorAllRarities}</Link>
          {allRarities.map((x) => <Link key={x} className={s.chip} href={href({ slot, rarity: x })} aria-current={rarity === x} >{tierPips(x)}{term("rarity", x, d)}</Link>)}
        </div>
      </div>
      {groups.map((g) => (
        <section key={g.slot} className={s.slot}>
          <h2>{term("slot", g.slot, d)}</h2>
          <div className={s.grid}>
            {g.cells.map((c) => {
              const known = isKnownRarity(c.rarity);
              const label = known ? term("rarity", c.rarity, d) : `${e.floorUnknownRarity}: ${humanizeCode(c.rarity)}`;
              const style = { ["--rank" as string]: String(Math.max(0, rarityRank(c.rarity))) };
              if ("empty" in c) return <div key={c.rarity} className={s.tile} data-empty="true" style={style}><span className={s.rar}>{label}{tierPips(c.rarity)}</span><span className={s.empty}>{e.floorNoOffers}</span></div>;
              const o = offers.get(`${c.slot}|${c.rarity}`);
              const stats = o?.stats ? Object.entries(o.stats) : [];
              return (
                <Link key={c.rarity} className={s.tile} href={`/equipment?slot=${encodeURIComponent(c.slot)}&rarity=${encodeURIComponent(c.rarity)}`} style={style} title={`${e.floorView}: ${term("slot", c.slot, d)} · ${label}`}>
                  <div className={s.top}>
                    <span className={s.img}>{o ? <ItemIcon code={o.itemCode} size={44} /> : <Icon name="box" size={22} />}</span>
                    <span className={s.rar}>{label}{tierPips(c.rarity)}</span>
                  </div>
                  <div className={s.price}><Money value={c.low} d={d} /></div>
                  {c.lowest && <span className={s.low}>{e.floorLowest}</span>}
                  <div className={s.meta}><span>{nf.format(c.offers)} {e.offersCount}</span>{o?.durability != null && <span>{e.floorDurability} {nf.format(o.durability)}</span>}</div>
                  {stats.length > 0 && <ul className={s.stats}>{stats.slice(0, 3).map(([k, v]) => <li key={k}>{(m.builds.skills as Record<string, string>)[k] ?? humanizeCode(k)} +{nf.format(v)}</li>)}</ul>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
