import { notFound, redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { SECTIONS } from "@/features/explorer/catalog";
import { DataView } from "@/features/explorer/DataView";
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
  return (
    <>
      <h1>{title}</h1>
      {tabs.length > 1 && <Tabs items={tabs} label={title} />}
      <p className="note">{m.explorer.genericNote} {m.explorer.linksNote}</p>
      <DataView data={result.data} section={null} detailLinks={false} labels={m.explorer} />
      <Provenance meta={result.meta} m={m} />
    </>
  );
}
