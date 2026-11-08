"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ImportVM, SourceTag } from "../view-model";
import { SKILL_IDS } from "../engine/skills";
import { Notice } from "./controls";
import { fmt } from "./format";
import type { BuilderMessages } from "./messages";

interface Suggestion { type: string; id: string; name: string; sub: string | null }
export type ImportState = "idle" | "loading" | "error";
const SRC_KIND: Record<SourceTag, string> = { api: "api", derived: "estimate", user: "calc", unavailable: "" };

export function PlayerPanel({ t, numLocale, imp, state, error, onSelect }: { t: BuilderMessages; numLocale: string; imp: ImportVM | null; state: ImportState; error: string | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); setSearched(false); return; }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`);
        const json = (await res.json()) as { results?: Suggestion[] };
        if (mine === seq.current) { setResults((json.results ?? []).filter((r) => r.type === "player")); setSearched(true); }
      } catch { if (mine === seq.current) { setResults([]); setSearched(true); } }
      finally { if (mine === seq.current) setBusy(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const p = t.player;
  const src = (s: SourceTag) => <span className="src" data-kind={SRC_KIND[s] || undefined}>{p.source[s]}</span>;
  return (
    <section className="bo-step panel" aria-labelledby="bo-step-player">
      <h2 id="bo-step-player"><span className="bo-num-badge">1</span>{p.title}</h2>
      <p className="note">{p.intro}</p>
      <div className="bo-search">
        <label className="bo-label" htmlFor="bo-q">{p.searchLabel}</label>
        <input id="bo-q" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={p.searchPlaceholder} autoComplete="off" />
        {busy ? <p className="hint" role="status">{p.searching}</p> : null}
        {searched && !busy && results.length === 0 ? <p className="hint">{p.noResults}</p> : null}
        {results.length > 0 ? (
          <ul className="bo-results" role="listbox" aria-label={p.searchLabel}>
            {results.map((r) => (
              <li key={r.id}><button type="button" className="bo-result" onClick={() => { setQ(""); setResults([]); onSelect(r.id); }}><strong>{r.name}</strong>{r.sub ? <span>{r.sub}</span> : null}<span className="bo-pick">{p.import}</span></button></li>
            ))}
          </ul>
        ) : null}
      </div>

      {state === "loading" ? <div aria-busy="true" aria-live="polite"><div className="skeleton" style={{ inlineSize: "50%" }} /><div className="skeleton" style={{ blockSize: "5rem" }} /><p className="hint">{p.loading}</p></div> : null}
      {state === "error" ? <Notice tone="bad" title={p.errorTitle}>{error ?? p.errorBody}</Notice> : null}

      {imp && state !== "loading" ? (
        <div className="bo-import">
          <header className="bo-import-head">
            <div><h3>{imp.player.name}</h3><span className="hint">{p.imported}</span></div>
            <button type="button" className="bo-ghost" onClick={() => onSelect(imp.player.id)}><Icon name="search" size={16} /> {p.reimport}</button>
          </header>
          <dl className="metrics">
            <div className="metric"><dt>{p.level}</dt><dd>{fmt(imp.player.level, numLocale)}</dd></div>
            <div className="metric"><dt>{p.rank}</dt><dd>{imp.player.rankName ? (t.ranks[imp.player.rankName as keyof typeof t.ranks] ?? imp.player.rankName) : "—"}</dd><dd className="metric-sub">{imp.player.rankBonusPct !== null ? `+${imp.player.rankBonusPct}% ${p.attack}` : ""}</dd></div>
            <div className="metric"><dt>{p.lifetimeDamage}</dt><dd>{imp.player.damageTotal !== null ? fmt(Number(imp.player.damageTotal), numLocale) : "—"}</dd></div>
            <div className="metric"><dt>{p.companies}</dt><dd>{fmt(imp.companies.count, numLocale)}</dd><dd className="metric-sub">{imp.companies.products.map((c) => `${c.code}×${c.count}`).join(" · ")}</dd></div>
          </dl>

          <div className="bo-two">
            <section className="card" aria-labelledby="bo-pts">
              <h2 id="bo-pts"><Icon name="trend" size={18} />{p.pointsTitle}</h2>
              <table className="table bo-kv"><tbody>
                <tr><th scope="row">{p.earned}</th><td>{fmt(imp.points.earned, numLocale)}{!imp.points.exact && imp.points.earned !== null ? <span className="badge" data-tone="bad">{p.lowerBound}</span> : null}</td></tr>
                <tr><th scope="row">{p.invested}</th><td>{fmt(imp.points.invested, numLocale)}</td></tr>
                <tr><th scope="row">{p.available}</th><td>{imp.points.available === null ? p.unknown : fmt(imp.points.available, numLocale)}</td></tr>
              </tbody></table>
              <p className="note">{imp.points.consistent === false ? p.ledgerConflict : imp.points.exact ? p.ledgerExact : p.ledgerLower}</p>
              {imp.points.impliedMinPrestige ? <p className="note">{p.impliedPrestige.replace("{n}", String(imp.points.impliedMinPrestige))}</p> : null}
            </section>
            <section className="card" aria-labelledby="bo-avail">
              <h2 id="bo-avail"><Icon name="contract" size={18} />{p.availabilityTitle}</h2>
              <table className="table bo-kv"><tbody>
                <tr><th scope="row">{p.fLevel}</th><td>{src(imp.provenance.level)}</td></tr>
                <tr><th scope="row">{p.fSkills}</th><td>{src(imp.provenance.skills)}</td></tr>
                <tr><th scope="row">{p.fRank}</th><td>{src(imp.provenance.rank)}</td></tr>
                <tr><th scope="row">{p.fCompanies}</th><td>{src(imp.provenance.companies)}</td></tr>
                <tr><th scope="row">{p.fMarket}</th><td>{imp.market.loaded ? <span className="src" data-kind="api">{fmt(imp.market.items, numLocale)}</span> : <span className="src">{p.source.unavailable}</span>}</td></tr>
                <tr><th scope="row">{p.fOffers}</th><td>{imp.offers ? <span className="src" data-kind="api">{fmt(imp.offers.total, numLocale)}</span> : <span className="src">{p.source.unavailable}</span>}</td></tr>
                <tr><th scope="row">{p.fGear}</th><td><span className="src">{p.needsInput}</span></td></tr>
                <tr><th scope="row">{p.fPill}</th><td><span className="src">{p.needsInput}</span></td></tr>
                <tr><th scope="row">{p.fStocks}</th><td><span className="src">{p.needsInput}</span></td></tr>
              </tbody></table>
            </section>
          </div>

          {imp.skills ? (
            <section className="card" aria-labelledby="bo-skills">
              <h2 id="bo-skills"><Icon name="war" size={18} />{p.skillsTitle}</h2>
              <div className="bo-skillgrid">
                {(["war", "economic"] as const).map((g) => (
                  <div key={g}><h3>{p.groups[g]}</h3>
                    <ul className="bo-skills">{SKILL_IDS.filter((id) => imp.skills!.find((s) => s.id === id)!.group === g).map((id) => { const s = imp.skills!.find((x) => x.id === id)!; return (
                      <li key={id}><span>{t.skills[id]}</span><span className="progress" aria-hidden="true"><span style={{ inlineSize: `${s.proposed * 10}%` }} /></span><b>{s.proposed}/10</b></li>); })}</ul>
                  </div>
                ))}
              </div>
            </section>
          ) : <Notice tone="bad" title={p.noSkillsTitle}>{p.noSkills}</Notice>}

          {Object.keys(imp.failures).length > 0 ? <Notice tone="warn" title={p.failuresTitle}><ul>{Object.entries(imp.failures).map(([k, v]) => <li key={k}><code>{k}</code>: {v}</li>)}</ul></Notice> : null}
          {imp.retained.length > 0 ? <p className="hint">{p.retained} {imp.retained.map((k) => p.retainedItems[k]).join(", ")}</p> : null}
          {imp.warnings.length > 0 ? <Notice tone="warn" title={p.warningsTitle}><ul>{imp.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Notice> : null}
          {imp.inferredMappings.length > 0 ? <p className="hint">{p.inferred}: {imp.inferredMappings.join(", ")}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
