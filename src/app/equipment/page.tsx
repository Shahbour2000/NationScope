import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { PageHero } from "@/components/PageHero";
import { Provenance } from "@/components/Provenance";
import { QueryPager } from "@/components/QueryPager";
import { Dt, ItemChip, Money, Source, StatusBadge } from "@/features/entities/entities";
import { term } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { SLOT_ORDER, RARITY_ORDER, floorMatrix } from "@/features/economy/analytics";
import { parseOffset } from "@/features/explorer/catalog";
import { getLocale, getMessages } from "@/i18n";
import { getEquipmentFloor, getEquipmentOffers } from "@/lib/data/economy";
import { humanizeCode } from "@/lib/format";

export const dynamic = "force-dynamic";
const PAGE = 18;
const SORTS = ["priceAsc", "priceDesc", "newest"] as const;

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ slot?: string; rarity?: string; sort?: string; offset?: string }> }) {
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const e = m.economyPage, u = m.pagesUi;
  const slot = SLOT_ORDER.includes(sp.slot ?? "") ? sp.slot : undefined;
  const rarity = RARITY_ORDER.includes(sp.rarity ?? "") ? sp.rarity : undefined;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORTS)[number]) : "priceAsc";
  const offset = parseOffset(sp.offset);
  let res;
  try { res = await getEquipmentOffers({ slot, rarity, sort, limit: PAGE, offset }); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const floor = await getEquipmentFloor().then((f) => f.rows).catch(() => null);
  const mx = floor ? floorMatrix(floor) : null;
  const totalOffers = floor ? floor.reduce((n, r) => n + (r.offers ?? 0), 0) : null;
  const filtered = Boolean(slot || rarity);
  return (
    <>
      <PageHero icon="box" kicker={u.kicker.equipment} title={m.nav.equipment} sub={<>{u.sub.equipment} {res.minLevel != null ? `${e.minLevelNote} ${res.minLevel}.` : ""}</>}
        actions={<><Link className="btn-ghost" href="/equipment-floor">{e.floorTitle}</Link><Source kind="api" d={d} /></>}
        kpis={mx && totalOffers !== null ? [
          { icon: "box", label: u.offersListed, value: nf.format(totalOffers) },
          { icon: "shield", label: u.slotsCovered, value: nf.format(mx.slots.length), tone: "green" },
          { icon: "flame", label: u.raritiesCovered, value: nf.format(mx.rarities.length), tone: "purple" },
        ] : undefined} />

      <form method="get" className="panel fbar" aria-label={u.filters}>
        <label>{e.slot}<select name="slot" className="field" defaultValue={slot ?? ""}><option value="">{e.allSlots}</option>{SLOT_ORDER.map((s) => <option key={s} value={s}>{term("slot", s, d)}</option>)}</select></label>
        <label>{e.rarity}<select name="rarity" className="field" defaultValue={rarity ?? ""}><option value="">{e.allRarities}</option>{RARITY_ORDER.map((s) => <option key={s} value={s}>{term("rarity", s, d)}</option>)}</select></label>
        <label>{d.m.ui.sortBy}<select name="sort" className="field" defaultValue={sort}><option value="priceAsc">{e.sortPrice}</option><option value="priceDesc">{e.sortPriceDesc}</option><option value="newest">{e.sortNew}</option></select></label>
        <button className="btn" type="submit">{d.m.ui.apply}</button>
        {filtered ? <Link className="btn-ghost" href="/equipment">{u.reset}</Link> : null}
      </form>

      {res.rows.length === 0 ? <p className="empty-mini panel">{e.noOffers}</p> : (
        <ul className="itemcards">
          {res.rows.map((o) => {
            const stats = Object.entries(o.stats ?? {});
            return (
              <li key={o.offerId} className="icard">
                <div className="ic-head">
                  <ItemChip code={o.itemCode} d={d} />
                  {o.rarity ? <StatusBadge value={o.rarity} group="rarity" d={d} /> : null}
                </div>
                <div className="ic-sub">{o.slot ? <span>{term("slot", o.slot, d)}</span> : null}<span>{u.durability}: <b>{o.durability ?? "—"}</b></span></div>
                {stats.length > 0 ? <span className="stat-chips">{stats.map(([k, v]) => <span key={k} className="chip">{(d.m.t.stat as Record<string, string>)[k] ?? humanizeCode(k)} {v}</span>)}</span> : <span className="hint">{u.noStats}</span>}
                <div className="ic-head"><span className="ic-price"><Money value={o.price} d={d} /></span></div>
                <div className="ic-foot">
                  <span>{o.sellerId && o.sellerName ? <Link href={`/players/${encodeURIComponent(o.sellerId)}`}>{o.sellerName}</Link> : (o.sellerName ?? "—")}</span>
                  <Dt iso={o.createdAt} d={d} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <QueryPager path="/equipment" params={{ slot, rarity, sort: sort === "priceAsc" ? undefined : sort }} offset={offset} step={PAGE} hasNext={res.nextOffset != null && res.rows.length >= PAGE} prev={m.explorer.prev} next={m.explorer.next} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
