import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { floorMatrix } from "@/features/economy/analytics";
import { Money, Source } from "@/features/entities/entities";
import { term } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getEquipmentFloor } from "@/lib/data/economy";

export const dynamic = "force-dynamic";

export default async function FloorPage() {
  const m = getMessages(await getLocale());
  const e = m.economyPage;
  let res;
  try { res = await getEquipmentFloor(); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  const mx = floorMatrix(res.rows);
  return (
    <>
      <div className="page-head"><h1><Icon name="box" size={26} />{e.floorTitle}</h1><Source kind="api" d={d} /></div>
      <p className="note">{e.floorNote} <Link href="/equipment">{e.cheapestOffers}</Link></p>
      <div className="tablewrap">
        <table className="heat">
          <thead><tr><th scope="col">{e.slot}</th>{mx.rarities.map((r) => <th key={r} scope="col">{term("rarity", r, d)}</th>)}</tr></thead>
          <tbody>
            {mx.slots.map((s) => (
              <tr key={s}>
                <th scope="row">{term("slot", s, d)}</th>
                {mx.rarities.map((r) => {
                  const cell = mx.cell.get(`${s}|${r}`);
                  return (
                    <td key={r} data-empty={cell ? "false" : "true"}>
                      {cell ? <><Money value={cell.low} d={d} /><small>{cell.offers} {e.offersCount}</small></> : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
