import { Icon } from "@/components/Icon";
import { Info } from "@/components/Info";
import { getActiveCitizenIds, loadBuilds } from "@/lib/data/players";
import type { Messages } from "@/i18n/messages";
import { BuildBadge } from "./BuildBadge";
import { summarizeBuilds, type BuildCounts, type BuildKind, type BuildResult } from "./classify";

export { BuildBadge };

/** Combat / Economy share bars for a player: percentages of the relevant skill investment (they add up to 100), shown with numbers, never colour alone. */
export function ScoreBars({ result, m, nl = "en" }: { result: BuildResult; m: Messages["builds"]; nl?: string }) {
  if (result.warShare === null || result.ecoShare === null) return <p className="empty-mini">{result.availability === "no_investment" ? m.noInvestment : m.incomplete}</p>;
  const nf = new Intl.NumberFormat(nl, { maximumFractionDigits: 1 });
  const row = (label: string, v: number, kind: "war" | "eco") => (
    <div className="sbar-row">
      <span>{label}</span>
      <span className="sbar" role="img" aria-label={`${label}: ${nf.format(v)}%`}><span data-kind={kind} style={{ inlineSize: `${v}%` }} /></span>
      <b>{nf.format(v)}%</b>
    </div>
  );
  return <div>{row(m.warScore, result.warShare, "war")}{row(m.ecoScore, result.ecoShare, "eco")}<p className="hint">{m.ofInvestment}</p></div>;
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/** Aggregate build mix for a group of players (unit, country, alliance, party). Loads through the capped, cached census loader. */
export async function BuildsPanel({ ids, m, nl, title }: { ids: readonly string[]; m: Messages["builds"]; nl: string; title?: string }) {
  const load = await loadBuilds(ids);
  return <BuildsSummaryView counts={summarizeBuilds(ids, load.results)} m={m} nl={nl} title={title} />;
}

/** Same panel for organisations made of countries (a country or an alliance): uses their ACTIVE citizens. */
export async function OrgBuildsPanel({ countryIds, m, nl, title }: { countryIds: readonly string[]; m: Messages["builds"]; nl: string; title?: string }) {
  const lists = await Promise.allSettled(countryIds.map((id) => getActiveCitizenIds(id)));
  const ids = lists.flatMap((l) => (l.status === "fulfilled" ? l.value : []));
  return <BuildsPanel ids={ids} m={m} nl={nl} title={title} />;
}

export function BuildsSummaryView({ counts: c, m, nl, title }: { counts: BuildCounts; m: Messages["builds"]; nl: string; title?: string }) {
  if (c.total === 0) return null;
  const nf = new Intl.NumberFormat(nl);
  const segs: { kind: BuildKind | "pending" | "unavailable"; n: number; label: string }[] = [
    { kind: "war", n: c.war, label: m.war }, { kind: "eco", n: c.eco, label: m.eco }, { kind: "hybrid", n: c.hybrid, label: m.hybrid },
    { kind: "unavailable", n: c.unavailable, label: m.unavailableLabel }, { kind: "pending", n: c.pending, label: m.pendingLabel },
  ];
  const complete = c.pending === 0 && c.unavailable === 0;
  return (
    <section className="panel builds" aria-label={title ?? m.title}>
      <header><h2><Icon name="flame" size={18} /> {title ?? m.title}</h2></header>
      <div className="mixbar" role="img" aria-label={segs.filter((s) => s.n > 0).map((s) => `${s.label}: ${s.n}`).join(", ")}>
        {segs.filter((s) => s.n > 0).map((s) => <span key={s.kind} data-kind={s.kind} style={{ flexGrow: s.n }} />)}
      </div>
      <ul className="mixlegend">
        {(["war", "eco", "hybrid"] as const).map((k) => <li key={k}><span className="bbadge" data-kind={k}>{m[k]}</span><b>{nf.format(c[k])}</b></li>)}
      </ul>
      <p className="hint">
        {fill(m.classifiedOf, { c: nf.format(c.classified), n: nf.format(c.total) })}
        {c.pending > 0 ? ` · ${fill(m.pending, { p: nf.format(c.pending) })}` : ""}
        {c.unavailable > 0 ? ` · ${fill(m.failed, { f: nf.format(c.unavailable) })}` : ""}
      </p>
      {!complete ? <p className="hint">{m.partial}{c.unavailable > 0 ? ` ${m.unavailableReason}` : ""}</p> : null}
      <p className="hint">{m.provisional}</p>
      <Info title={m.methodTitle}><p>{m.method}</p></Info>
    </section>
  );
}
