import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { ProfileHeader } from "@/components/ProfileHeader";
import { Provenance } from "@/components/Provenance";
import { StateMessage } from "@/components/StateMessage";
import { CompanyProfile } from "@/features/companies/CompanyProfile";
import { getDisplay } from "@/features/entities/display.server";
import { CountryBadge, ItemChip, RegionLink, StatusBadge } from "@/features/entities/entities";
import { getLocale, getMessages } from "@/i18n";
import { getCompanyDetail } from "@/lib/data/company-detail";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!safe(id)) notFound();
  const m = getMessages(await getLocale());
  const t = m.companyPage;
  const back = <Link className="btn-ghost" href="/companies" style={{ marginBlockEnd: "0.7rem", display: "inline-flex" }}><Icon name="chevron" size={14} />{t.back}</Link>;
  let res;
  try { res = await getCompanyDetail(id); } catch (e) { return <>{back}<ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  if (!res.company) return <>{back}<StateMessage tone="empty" title={t.notFound} detail={t.notRecognised} /></>;
  const c = res.company;
  const d = await getDisplay();
  const stats = [
    ...(c.incomeTax != null ? [{ label: t.incomeTax, value: `${c.incomeTax}%` }] : []),
    ...(c.bonusTotal != null ? [{ label: t.bonusTotal, value: `+${c.bonusTotal}%` }] : []),
  ];
  return (
    <>
      {back}
      <ProfileHeader
        image={<span className="phead-fallback"><Icon name="factory" size={32} /></span>}
        kicker={<>{c.owner ? <span>{t.owner}: {c.owner.username}</span> : null}{c.regionId ? <RegionLink id={c.regionId} d={d} /> : null}{c.countryId ? <CountryBadge id={c.countryId} d={d} /> : null}</>}
        title={c.name}
        badges={<><ItemChip code={c.itemCode} d={d} href={`/market/${encodeURIComponent(c.itemCode)}`} />{c.status ? <StatusBadge value={c.status} d={d} /> : null}</>}
        stats={stats.length ? stats : undefined} statsLabel={t.facts}
      />
      <CompanyProfile company={c} d={d} m={m} nowMs={Date.now()} />
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
