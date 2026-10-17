import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Pager } from "@/components/Pager";
import { Provenance } from "@/components/Provenance";
import { Tabs } from "@/components/Tabs";
import { DEFAULT_PAGE_SIZE, SECTIONS, parseOffset } from "@/features/explorer/catalog";
import { DataView } from "@/features/explorer/DataView";
import { listOf } from "@/features/explorer/shape";
import { getLocale, getMessages } from "@/i18n";
import { fetchEndpoint } from "@/lib/data/explore";

export const dynamic = "force-dynamic";

export default async function SubPage({ params, searchParams }: { params: Promise<{ section: string; id: string; sub: string }>; searchParams: Promise<{ offset?: string }> }) {
  const { section, id, sub } = await params;
  const def = SECTIONS[section];
  const subDef = def?.subs?.find((s) => s.slug === sub);
  if (!def || !subDef) notFound();
  const m = getMessages(await getLocale());
  const subs = m.explorer.subs as Record<string, string>;
  const title = `${(m.explorer.sections as Record<string, string>)[section] ?? section} · ${id} · ${subs[sub] ?? sub}`;
  const base = `/${section}/${encodeURIComponent(id)}`;
  const tabs = [
    ...(def.detail ? [{ href: base, label: m.explorer.overviewTab, current: false }] : []),
    ...(def.subs ?? []).map((s) => ({ href: `${base}/${s.slug}`, label: subs[s.slug] ?? s.slug, current: s.slug === sub })),
  ];
  const pageSize = DEFAULT_PAGE_SIZE;
  const offset = subDef.paged ? parseOffset((await searchParams).offset) : 0;
  let result;
  try {
    result = await fetchEndpoint(subDef.endpoint(id, { limit: pageSize, offset }));
  } catch (error) {
    return (<><h1>{title}</h1><Tabs items={tabs} label={title} /><ApiErrorState error={error} retryLabel={m.common.retry} /></>);
  }
  const rowCount = listOf(result.data)?.rows.length ?? 0;
  return (
    <>
      <h1>{title}</h1>
      <Tabs items={tabs} label={title} />
      <p className="note">{m.explorer.genericNote} {m.explorer.linksNote}</p>
      <DataView data={result.data} section={null} detailLinks={false} labels={m.explorer} />
      {subDef.paged && <Pager basePath={`${base}/${sub}`} offset={offset} pageSize={pageSize} rowCount={rowCount} prev={m.explorer.prev} next={m.explorer.next} />}
      <Provenance meta={result.meta} m={m} />
    </>
  );
}
