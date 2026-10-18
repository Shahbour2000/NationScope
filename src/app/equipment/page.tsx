import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { QueryPager } from "@/components/QueryPager";
import { Dt, ItemChip, Money, Source, StatusBadge } from "@/features/entities/entities";
import { term } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { SLOT_ORDER, RARITY_ORDER } from "@/features/economy/analytics";
import { parseOffset } from "@/features/explorer/catalog";
import { getLocale, getMessages } from "@/i18n";
import { getEquipmentOffers } from "@/lib/data/economy";
import { humanizeCode } from "@/lib/format";

export const dynamic = "force-dynamic";
const PAGE = 24;
const SORTS = ["priceAsc", "priceDesc", "newest"] as const;

export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ slot?: string; rarity?: string; sort?: string; offset?: string }> }) {
  const sp = await searchParams;
  const m = getMessages(await getLocale());
  const e = m.economyPage;
  const slot = SLOT_ORDER.includes(sp.slot ?? "") ? sp.slot : undefined;
  const rarity = RARITY_ORDER.includes(sp.rarity ?? "") ? sp.rarity : undefined;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as (typeof SORTS)[number]) : "priceAsc";
  const offset = parseOffset(sp.offset);
  let res;
  try { res = await getEquipmentOffers({ slot, rarity, sort, limit: PAGE, offset }); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  return (
    <>
      <div className="page-head"><h1><Icon name="box" size={26} />{m.nav.equipment}</h1><Source kind="api" d={d} /></div>
      <p className="note">{e.floorNote} <Link href="/equipment-floor">{e.floorTitle}</Link>{res.minLevel != null ? ` · ${e.minLevelNote} ${res.minLevel}` : ""}</p>
      <form method="get" className="filterbar">
        <label>{e.slot}<select name="slot" className="field" defaultValue={slot ?? ""}><option value="">{e.allSlots}</option>{SLOT_ORDER.map((s) => <option key={s} value={s}>{term("slot", s, d)}</option>)}</select></label>
        <label>{e.rarity}<select name="rarity" className="field" defaultValue={rarity ?? ""}><option value="">{e.allRarities}</option>{RARITY_ORDER.map((s) => <option key={s} value={s}>{term("rarity", s, d)}</option>)}</select></label>
        <label>{d.m.ui.sortBy}<select name="sort" className="field" defaultValue={sort}><option value="priceAsc">{e.sortPrice}</option><option value="priceDesc">{e.sortPriceDesc}</option><option value="newest">{e.sortNew}</option></select></label>
        <button className="btn" type="submit">{d.m.ui.apply}</button>
      </form>
      <div className="tablewrap">
        <table className="table">
          <thead><tr><th scope="col">{m.economyPage.item}</th><th scope="col">{e.rarity}</th><th scope="col">{e.stats}</th><th scope="col" className="num">{e.durability}</th><th scope="col" className="num">{e.price}</th><th scope="col">{e.seller}</th><th scope="col">{e.listed}</th></tr></thead>
          <tbody>
            {res.rows.map((o) => (
              <tr key={o.offerId}>
                <td data-label={e.item}><ItemChip code={o.itemCode} d={d} />{o.slot ? <span className="hint"> · {term("slot", o.slot, d)}</span> : null}</td>
                <td data-label={e.rarity}>{o.rarity ? <StatusBadge value={o.rarity} group="rarity" d={d} /> : "—"}</td>
                <td data-label={e.stats}><span className="stat-chips">{Object.entries(o.stats ?? {}).map(([k, v]) => <span key={k} className="chip">{(d.m.t.stat as Record<string, string>)[k] ?? humanizeCode(k)} {v}</span>)}</span></td>
                <td className="num" data-label={e.durability}>{o.durability ?? "—"}</td>
                <td className="num" data-label={e.price}><Money value={o.price} d={d} /></td>
                <td data-label={e.seller}>{o.sellerId && o.sellerName ? <Link href={`/players/${encodeURIComponent(o.sellerId)}`}>{o.sellerName}</Link> : (o.sellerName ?? "—")}</td>
                <td data-label={e.listed}><Dt iso={o.createdAt} d={d} /></td>
              </tr>
            ))}
            {res.rows.length === 0 && <tr><td colSpan={7}>{e.noOffers}</td></tr>}
          </tbody>
        </table>
      </div>
      <QueryPager path="/equipment" params={{ slot, rarity, sort: sort === "priceAsc" ? undefined : sort }} offset={offset} step={PAGE} hasNext={res.nextOffset != null && res.rows.length >= PAGE} prev={m.explorer.prev} next={m.explorer.next} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
