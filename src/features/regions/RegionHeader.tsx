import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Tabs } from "@/components/Tabs";
import type { Display } from "@/features/entities/display";
import { CountryBadge, Flag } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import { regionName } from "@/lib/domain/directory";
import type { RegionDetail } from "@/lib/domain/region-detail";
import s from "./region.module.css";

export type RegionTab = "overview" | "companies" | "battles";
const nfOf = (d: Display) => new Intl.NumberFormat(d.nl);

/** Identity header + section tabs shared by the three region pages. `region` may be null when only the id is known. */
export function RegionHeader({ id, region, current, d, m }: { id: string; region: RegionDetail | null; current: RegionTab; d: Display; m: Messages }) {
  const t = m.regionPage, nf = nfOf(d);
  const name = region?.name?.trim() || regionName(id, d.dir);
  const base = `/regions/${encodeURIComponent(id)}`;
  const num = (v: number | null | undefined) => (v == null ? "—" : nf.format(v));
  const badges = region ? (
    <>
      {region.isCapital ? <span className={s.badge} data-tone="gold">{t.capital}</span> : null}
      {region.occupied ? <span className={s.badge} data-tone="warn">{t.occupied}</span> : null}
      {region.hasCoast != null ? <span className={s.badge}>{region.hasCoast ? t.coastal : t.inland}</span> : null}
    </>
  ) : null;
  const kicker = region ? (
    <>
      {region.countryId ? <><span>{t.heldBy}</span><CountryBadge id={region.countryId} d={d} /></> : null}
      {region.occupied && region.coreCountryId ? <><span>{t.coreOf}</span><CountryBadge id={region.coreCountryId} d={d} /></> : null}
    </>
  ) : null;
  const stats = region ? [
    { label: t.development, value: num(region.development) },
    { label: t.residents, value: num(region.residents) },
    { label: t.present, value: num(region.present) },
    { label: t.companies, value: num(region.companies) },
  ] : undefined;
  const tabs = [
    { href: base, label: t.tabOverview, current: current === "overview" },
    { href: `${base}/companies`, label: t.tabCompanies, current: current === "companies", count: region?.companies ?? null },
    { href: `${base}/campaign`, label: t.tabBattles, current: current === "battles" },
  ];
  return (
    <>
      <Link className={s.back} href="/regions"><Icon name="chevron" size={14} />{t.back}</Link>
      <ProfileHeader
        image={region?.countryId ? <span className={s.flagBox}><Flag id={region.countryId} d={d} /></span> : <span className="phead-fallback"><Icon name="map" size={32} /></span>}
        kicker={kicker} title={name} badges={badges} stats={stats} statsLabel={t.stats}
      />
      <Tabs items={tabs} label={t.tabsLabel} />
    </>
  );
}
