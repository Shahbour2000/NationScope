import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { PartiesBoard } from "@/features/politics/PartiesBoard";
import { getLocale, getMessages } from "@/i18n";
import { countryName } from "@/features/entities/display";
import { getWorldParties } from "@/lib/data/world";
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
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 0.6rem", maxInlineSize: "62rem" }}>{t.intro}</p>
      <p role="status" data-partial={res.missing.length > 0} style={{ margin: "0 0 1.2rem", padding: "0.5rem 0.8rem", borderRadius: 10, maxInlineSize: "62rem", fontSize: "0.85rem", border: `1px ${res.missing.length > 0 ? "solid rgba(245, 197, 66, 0.55)" : "solid rgba(74, 222, 128, 0.35)"}`, color: res.missing.length > 0 ? "#f5d77a" : "#8fd9ae", background: res.missing.length > 0 ? "rgba(245, 197, 66, 0.07)" : "rgba(74, 222, 128, 0.05)" }}>
        {res.missing.length === 0 ? t.coverageAll.replace("{n}", String(res.total)) : t.coveragePartial.replace("{c}", String(res.covered)).replace("{n}", String(res.total)).replace("{names}", res.missing.slice(0, 8).map((id) => countryName(id, d.dir)).join(", ") + (res.missing.length > 8 ? "…" : ""))}
      </p>
      {rows.length === 0 ? <p style={{ color: "#7b87a3", textAlign: "center", padding: "2.5rem 0" }}>{t.empty}</p> : <PartiesBoard rows={rows} d={d} m={{ ...t, ethic: m.partiesPage.ethic }} />}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
