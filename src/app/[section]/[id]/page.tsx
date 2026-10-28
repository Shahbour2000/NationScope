import { notFound, redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { SECTIONS } from "@/features/explorer/catalog";
import { getDisplay } from "@/features/entities/display.server";
import { DataView } from "@/features/explorer/DataView";
import { entityTitle, isRecord } from "@/features/explorer/shape";
import { Suspense } from "react";
import { BuildsPanel } from "@/features/builds/BuildViews";
import { PinButton } from "@/features/pins/PinButton";
import { mediaSrc } from "@/lib/media";
import { getLocale, getMessages } from "@/i18n";
import { fetchEndpoint } from "@/lib/data/explore";

export const dynamic = "force-dynamic";

export default async function DetailPage({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { section, id } = await params;
  const def = SECTIONS[section];
  if (!def) notFound();
  if (!def.detail) {
    const first = def.subs?.[0];
    if (!first) notFound();
    redirect(`/${section}/${encodeURIComponent(id)}/${first.slug}`);
  }
  const m = getMessages(await getLocale());
  const title = `${(m.explorer.sections as Record<string, string>)[section] ?? section} · ${id}`;
  const base = `/${section}/${encodeURIComponent(id)}`;
  const tabs = [
    { href: base, label: m.explorer.overviewTab, current: true },
    ...(def.subs ?? []).map((s) => ({ href: `${base}/${s.slug}`, label: (m.explorer.subs as Record<string, string>)[s.slug] ?? s.slug, current: false })),
  ];
  let result;
  try {
    result = await fetchEndpoint(def.detail(id));
  } catch (error) {
    return (<><h1>{title}</h1><ApiErrorState error={error} retryLabel={m.common.retry} /></>);
  }
  const d = await getDisplay();
  const heading = entityTitle(result.data) ?? (m.explorer.sections as Record<string, string>)[section] ?? section;
  const pinType = ({ players: "player", parties: "party", units: "unit" } as const)[section as "players" | "parties" | "units"];
  const rec = isRecord(result.data) ? result.data : {};
  const img = mediaSrc(typeof rec.avatarUrl === "string" ? rec.avatarUrl : typeof rec.logoUrl === "string" ? rec.logoUrl : null, d.mediaOrigin);
  const memberIds = section === "parties" && Array.isArray(rec.members) ? rec.members.flatMap((x) => (isRecord(x) && typeof x.userId === "string" ? [x.userId] : [])) : [];
  return (
    <>
      <div className="page-head"><h1>{heading}</h1>{pinType && <PinButton labels={m.pins} target={{ type: pinType, id, name: heading, image: img, href: `/${section}/${encodeURIComponent(id)}` }} />}</div>
      {memberIds.length > 0 ? <div style={{ marginBlockEnd: "1rem" }}><Suspense fallback={<div className="skeleton" style={{ blockSize: "7rem" }} />}><BuildsPanel ids={memberIds} m={m.builds} nl={d.nl} /></Suspense></div> : null}
      {tabs.length > 1 && <Tabs items={tabs} label={title} />}
      <p className="note">{m.explorer.genericNote} {m.explorer.linksNote}</p>
      <DataView data={result.data} section={null} detailLinks={false} labels={m.explorer} d={d} />
      <Provenance meta={result.meta} m={m} />
    </>
  );
}
