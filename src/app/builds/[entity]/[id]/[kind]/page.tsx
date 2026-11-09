import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ApiErrorState";
import { classifyKinds } from "@/features/builds/list";
import { MembersTable } from "@/features/builds/MembersTable";
import { entityHref, getMixMembers, isMixEntity, mixHref, type MixEntity } from "@/features/builds/members";
import { countryName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { loadBuilds } from "@/lib/data/players";
import s from "./list.module.css";

export const dynamic = "force-dynamic";
const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);
const KINDS = ["war", "eco", "hybrid"] as const;
type Kind = (typeof KINDS)[number];

/** Which players make up one WAR / ECO / HYBRID count of a country, unit, party or alliance. Same member source and classifier as the count itself. */
export default async function BuildMembersPage({ params }: { params: Promise<{ entity: string; id: string; kind: string }> }) {
  const { entity, id, kind } = await params;
  if (!isMixEntity(entity) || !safe(id) || !(KINDS as readonly string[]).includes(kind)) notFound();
  const e: MixEntity = entity, k = kind as Kind;
  const m = getMessages(await getLocale());
  const b = m.builds;
  let members;
  try { members = await getMixMembers(e, id); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  if (!members) notFound();
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  // The list page may request more profiles than an overview render; whatever is still missing is reported, never counted.
  const load = await loadBuilds(members.ids, { maxFetch: 80, concurrency: 6 });
  const { rows, counts } = classifyKinds(members.ids, load, k);
  const tableRows = rows.map((r) => ({ ...r, countryName: r.countryId ? countryName(r.countryId, d.dir) : "" }));
  const label = b[k];
  const name = members.name ?? id;
  const notes: string[] = [];
  if (counts.pending > 0) notes.push(b.coverageNote.replace("{c}", nf.format(counts.classified)).replace("{n}", nf.format(counts.total)));
  if (counts.unavailable > 0) notes.push(b.unavailableNote.replace("{u}", nf.format(counts.unavailable)));
  if (members.truncated) notes.push(b.truncatedNote);
  return (
    <>
      <nav className={s.back}><Link href={entityHref(e, id)}>← {b.backTo.replace("{name}", name)}</Link></nav>
      <div className="page-head"><h1><span className={s.kind} data-k={k}>{b.membersTitle.replace("{kind}", label)}</span> <small dir="auto">{b.membersOf.replace("{name}", name)}</small></h1></div>
      <nav className={s.switch} aria-label={b.title}>
        {KINDS.map((x) => <Link key={x} href={mixHref(e, id, x)} aria-current={x === k ? "page" : undefined} data-k={x}>{b[x]}<b>{nf.format(counts[x])}</b></Link>)}
      </nav>
      <p className="note">{b.totalPlayers.replace("{n}", nf.format(rows.length))}</p>
      {notes.map((n) => <p key={n} className={s.note}>{n}</p>)}
      {rows.length === 0
        ? <p className="empty">{b.noneMatching.replace("{kind}", label)}</p>
        : <MembersTable rows={tableRows} d={d} nl={d.nl} labels={{ player: b.colPlayer, country: b.colCountry, level: b.colLevel, war: b.colWar, eco: b.colEco, search: b.searchPlayers, prev: d.m.ui.prev, next: d.m.ui.next, page: d.m.ui.page, none: d.m.ui.none }} />}
      <p className={s.note}>{b.provisional}</p>
    </>
  );
}
