import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { PartiesBoard } from "@/features/politics/PartiesBoard";
import { getLocale, getMessages } from "@/i18n";
import { PARTY_COUNTRY_CAP, getWorldParties } from "@/lib/data/world";
import { mediaSrc } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function PartiesPage() {
  const m = getMessages(await getLocale());
  const t = m.worldParties;
  let res;
  try { res = await getWorldParties(); } catch (e) { return <><h1>{t.title}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const rows = res.rows.map((p) => ({ ...p, logoSrc: mediaSrc(p.logoUrl, d.mediaOrigin) }));
  return (
    <>
      <div className="page-head"><h1><Icon name="users" size={26} />{t.title}</h1></div>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.2rem", maxInlineSize: "62rem" }}>{t.intro} {t.covered.replace("{n}", String(Math.min(PARTY_COUNTRY_CAP, res.covered)))}</p>
      {rows.length === 0 ? <p style={{ color: "#7b87a3", textAlign: "center", padding: "2.5rem 0" }}>{t.empty}</p> : <PartiesBoard rows={rows} d={d} m={{ ...t, ethic: m.partiesPage.ethic }} />}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
