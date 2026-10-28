import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { getActiveCitizenIds, loadBuilds, type BuildLoad } from "@/lib/data/players";
import type { Messages } from "@/i18n/messages";
import { BuildBadge } from "./BuildBadge";
import { summarizeBuilds, type BuildCounts, type BuildKind, type BuildResult } from "./classify";

export { BuildBadge };

/** Two score bars (War / Eco) for a player; values are the provisional scores, shown with their numbers (never colour alone). */
export function ScoreBars({ result, m }: { result: BuildResult; m: Messages["builds"] }) {
  const row = (label: string, v: number | null, kind: "war" | "eco") => (
    <div className="sbar-row">
      <span>{label}</span>
      <span className="sbar" role="img" aria-label={`${label}: ${v ?? "—"}`}><span data-kind={kind} style={{ inlineSize: `${v ?? 0}%` }} /></span>
      <b>{v === null ? "—" : v.toFixed(1)}</b>
    </div>
  );
  return <div>{row(m.warScore, result.warScore, "war")}{row(m.ecoScore, result.ecoScore, "eco")}</div>;
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/** Aggregate build mix for a group of players (unit, country, alliance, party). Loads through the capped, cached census loader. */
export async function BuildsPanel({ ids, m, nl, title }: { ids: readonly string[]; m: Messages["builds"]; nl: string; title?: string }) {
  const load = await loadBuilds(ids);
  return <BuildsSummaryView counts={summarizeBuilds(ids, load.results)} load={load} m={m} nl={nl} title={title} />;
}

/** Same panel for organisations made of countries (a country or an alliance): uses their ACTIVE citizens. */
export async function OrgBuildsPanel({ countryIds, m, nl, title }: { countryIds: readonly string[]; m: Messages["builds"]; nl: string; title?: string }) {
  const lists = await Promise.allSettled(countryIds.map((id) => getActiveCitizenIds(id)));
  const ids = lists.flatMap((l) => (l.status === "fulfilled" ? l.value : []));
  return <BuildsPanel ids={ids} m={m} nl={nl} title={title} />;
}

export function BuildsSummaryView({ counts: c, load, m, nl, title }: { counts: BuildCounts; load: Pick<BuildLoad, "pending" | "failed">; m: Messages["builds"]; nl: string; title?: string }) {
  if (c.total === 0) return null;
  const nf = new Intl.NumberFormat(nl);
  const classified = c.total - c.unknown - c.insufficient;
  const segs: { kind: BuildKind | "unknown"; n: number }[] = [
    { kind: "war", n: c.war }, { kind: "eco", n: c.eco }, { kind: "hybrid", n: c.hybrid }, { kind: "unclassified", n: c.unclassified }, { kind: "insufficient", n: c.insufficient }, { kind: "unknown", n: c.unknown },
  ];
  return (
    <section className="panel builds" aria-label={title ?? m.title}>
      <header><h2><Icon name="flame" size={18} /> {title ?? m.title}</h2></header>
      <div className="mixbar" role="img" aria-label={segs.filter((s) => s.n > 0).map((s) => `${s.kind === "unknown" ? m.unknown : m[s.kind]}: ${s.n}`).join(", ")}>
        {segs.filter((s) => s.n > 0).map((s) => <span key={s.kind} data-kind={s.kind} style={{ flexGrow: s.n }} />)}
      </div>
      <ul className="mixlegend">
        {(["war", "eco", "hybrid"] as const).map((k) => <li key={k}><span className="bbadge" data-kind={k}>{m[k]}</span><b>{nf.format(c[k])}</b></li>)}
        <li><span className="bbadge" data-kind="unclassified">{m.unclassified}</span><b>{nf.format(c.unclassified)}</b></li>
        {c.insufficient > 0 && <li><span className="bbadge" data-kind="insufficient">{m.insufficient}</span><b>{nf.format(c.insufficient)}</b></li>}
      </ul>
      <p className="hint">
        {fill(m.classifiedOf, { c: nf.format(classified), n: nf.format(c.total) })}
        {load.pending > 0 ? ` · ${fill(m.pending, { p: nf.format(load.pending) })}` : ""}
        {load.failed > 0 ? ` · ${fill(m.failed, { f: nf.format(load.failed) })}` : ""}
      </p>
      <p className="hint">{m.provisional}</p>
      <Info title={m.methodTitle}><p>{m.method}</p></Info>
    </section>
  );
}
