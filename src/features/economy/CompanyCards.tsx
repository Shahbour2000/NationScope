import Link from "next/link";
import { companyUpgradeTotal } from "./analytics";
import type { Display } from "@/features/entities/display";
import { CountryBadge, ItemChip, PlayerChip, RegionLink } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import type { Company } from "@/lib/domain/economy";

/** Company cards (name, product, owner, location, level/workers/steel, upgrade bars). Shared by the world and country company pages. */
export function CompanyCards({ rows, d, m }: { rows: Company[]; d: Display; m: Messages }) {
  const c = m.companiesPage, u = m.pagesUi;
  const nf = new Intl.NumberFormat(d.nl);
  return (
  <ul className="itemcards">
    {rows.map((x) => {
      const up: [string, number | null | undefined][] = [[c.storage, x.storageLevel], [c.engine, x.engineLevel], [c.breakRoom, x.breakRoomLevel]];
      const topLvl = Math.max(1, ...up.map(([, v]) => v ?? 0));
      return (
        <li key={x.id} className="icard">
          <div className="ic-head">
            <Link className="ic-title" href={`/companies/${encodeURIComponent(x.id)}`} dir="auto" title={x.name}>{x.name}</Link>
            <ItemChip code={x.itemCode} d={d} href={`/market/${encodeURIComponent(x.itemCode)}`} />
          </div>
          <div className="ic-sub">
            {x.owner ? <PlayerChip id={x.owner.id} name={x.owner.username} avatar={x.owner.avatarUrl} d={d} /> : null}
            {x.regionId ? <RegionLink id={x.regionId} d={d} /> : null}
            {x.countryId ? <CountryBadge id={x.countryId} d={d} /> : null}
          </div>
          <div className="ic-nums">
            <div><b>{x.level == null ? "—" : nf.format(x.level)}</b><small>{c.level}</small></div>
            <div><b>{x.workers == null ? "—" : nf.format(x.workers)}</b><small>{c.workers}</small></div>
            <div><b>{x.investedSteel == null ? "—" : nf.format(x.investedSteel)}</b><small>{c.investedSteel}</small></div>
          </div>
          <div className="upgr" aria-label={`${c.upgrades}: ${u.upgradeLevels} ${companyUpgradeTotal(x)}`}>
            {up.map(([label, v]) => <div key={label}><span>{label}</span><span className="sbar" aria-hidden="true"><span style={{ inlineSize: `${Math.round(((v ?? 0) / topLvl) * 100)}%` }} /></span><b>{v == null ? "—" : v}</b></div>)}
          </div>
        </li>
      );
    })}
  </ul>
  );
}
