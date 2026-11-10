"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImportVM, ResultVM } from "../view-model";
import { DataPanel } from "./DataPanel";
import { GoalPanel } from "./GoalPanel";
import { PlayerPanel, type ImportState } from "./PlayerPanel";
import { ResultsPanel } from "./ResultsPanel";
import { Ev, Notice } from "./controls";
import { SkillPinGrid } from "./SkillPinGrid";
import { ADVISORY, defaultForm, toRequestBody, validate, type FormState } from "./form";
import type { BuilderMessages } from "./messages";

/** The whole Build Optimizer experience: import, goal, details, calculate, result. All calculation happens on the server through /api/build-optimizer/*. */
export function BuilderApp({ t, numLocale, initialPlayer }: { t: BuilderMessages; numLocale: string; initialPlayer?: string }) {
  const [imp, setImp] = useState<ImportVM | null>(null);
  const [impState, setImpState] = useState<ImportState>("idle");
  const [impError, setImpError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [result, setResult] = useState<ResultVM | null>(null);
  const [running, setRunning] = useState(false);
  const [tried, setTried] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const runSeq = useRef(0);
  const importedId = useRef<string | null>(null);

  const selectPlayer = useCallback(async (id: string) => {
    setImpState("loading"); setImpError(null); setResult(null); setTried(false);
    try {
      const res = await fetch(`/api/build-optimizer/import?player=${encodeURIComponent(id)}`);
      const json = (await res.json()) as { ok: boolean; import?: ImportVM; error?: string };
      if (!json.ok || !json.import) { setImp(null); setImpState("error"); setImpError(json.error ?? null); return; }
      setImp(json.import); setImpState("idle");
      const same = importedId.current === id; importedId.current = id;
      if (!same) setForm(defaultForm());
    } catch { setImp(null); setImpState("error"); setImpError(null); }
  }, []);

  useEffect(() => { if (initialPlayer) void selectPlayer(initialPlayer); }, [initialPlayer, selectPlayer]);

  const update = useCallback((fn: (f: FormState) => FormState) => setForm(fn), []);
  const set = useCallback((patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })), []);

  const issues = validate(form, imp);
  const blocking = issues.filter((i) => !ADVISORY.has(i.key));
  const advisory = issues.filter((i) => ADVISORY.has(i.key));

  const run = async () => {
    setTried(true);
    if (!imp || blocking.length > 0) return;
    const mine = ++runSeq.current;
    setRunning(true); setResult(null);
    try {
      const res = await fetch("/api/build-optimizer/optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toRequestBody(form, imp.player.id)) });
      const json = (await res.json()) as ResultVM;
      if (mine === runSeq.current) setResult(json);
    } catch {
      if (mine === runSeq.current) setResult({ ok: false, reason: "error", message: t.results.reasonHelp.error, details: [] });
    } finally {
      if (mine === runSeq.current) { setRunning(false); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }
    }
  };

  return (
    <div className="bo" data-mode={form.mode}>
      <aside className="bo-legend panel" aria-label={t.legend.title}>
        <strong>{t.legend.title}</strong>
        <div className="bo-legend-row">{(["verified", "documented", "estimated", "unverified", "unknown"] as const).map((s) => <span key={s} className="bo-legend-item"><Ev status={s} t={t} /><small>{t.evidence[`${s}Desc` as const]}</small></span>)}</div>
        <p className="hint">{t.legend.note}</p>
      </aside>

      <PlayerPanel t={t} numLocale={numLocale} imp={imp} state={impState} error={impError} onSelect={(id) => void selectPlayer(id)}
        skillsSlot={imp ? <SkillPinGrid t={t} numLocale={numLocale} imp={imp} constraints={form.constraints} onChange={(constraints) => set({ constraints })} /> : null} />

      {imp && imp.skills ? (
        <>
          <GoalPanel t={t} form={form} set={set} />
          <DataPanel t={t} form={form} update={update} imp={imp} issues={tried ? issues : []} />
          <section className="bo-step panel bo-runbar" aria-labelledby="bo-step-run">
            <h2 id="bo-step-run"><span className="bo-num-badge">4</span>{t.run.title}</h2>
            {blocking.length > 0 ? (
              <Notice tone={tried ? "bad" : "info"} title={t.run.fixIssues}><ul>{blocking.map((i) => <li key={`${i.key}${i.field ?? ""}`}>{t.issues[i.key as keyof typeof t.issues] ?? i.key}</li>)}</ul></Notice>
            ) : <p className="hint">{t.run.ready}</p>}
            {advisory.length > 0 ? <Notice tone="info" title={t.run.advisory}><ul>{advisory.map((i) => <li key={i.key}>{t.issues[i.key as keyof typeof t.issues] ?? i.key}</li>)}</ul><p>{t.run.warnOnly}</p></Notice> : null}
            <button type="button" className="bo-primary" onClick={() => void run()} disabled={running} aria-busy={running}>{running ? t.run.running : t.run.button}</button>
          </section>
        </>
      ) : null}

      <div ref={resultRef} aria-live="polite">
        {running ? <div className="bo-step panel" aria-busy="true"><div className="skeleton" style={{ inlineSize: "40%" }} /><div className="skeleton" style={{ blockSize: "8rem" }} /><div className="skeleton" /><p className="hint">{t.run.running}</p></div> : null}
        {result && !running ? <ResultsPanel result={result} t={t} numLocale={numLocale} /> : null}
      </div>
    </div>
  );
}
