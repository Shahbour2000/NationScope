import Link from "next/link";
import { notFound } from "next/navigation";
import { tryGetConfig } from "@/lib/config/env";
import { ENVIRONMENTS } from "@/lib/config/environments";
import { StateMessage } from "@/components/StateMessage";
import { diagnosticsEnabled, discoverAndProbe, parseExplorerInput, probe, probeAll } from "@/lib/diagnostics/probe";
import { PROBE_ENDPOINTS } from "@/lib/api/endpoints";
import { headline, renderShape } from "@/lib/diagnostics/shape";

export const dynamic = "force-dynamic";

const RAW_LIMIT = 8000;

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; q?: string; all?: string; ids?: string; page?: string }>;
}) {
  if (!diagnosticsEnabled()) notFound();
  const config = tryGetConfig();
  if (!config) {
    return <StateMessage tone="error" title="Configuration problem" detail="Fix the environment configuration first." />;
  }
  const sp = await searchParams;
  const input = sp.path ? parseExplorerInput(sp.path, sp.q) : undefined;
  const single = input && !("error" in input) ? await probe(input) : undefined;
  const bulk = sp.all === "1" ? await probeAll() : undefined;
  const idRun = sp.ids === "1" ? await discoverAndProbe(Number(sp.page) || 1) : undefined;
  const env = ENVIRONMENTS[config.environment];

  return (
    <>
      <h1>API diagnostics</h1>
      <p className="note">
        Environment: <strong>{env.label}</strong> ({new URL(config.origin).host}{config.pathPrefix}). Read-only requests to
        documented paths, throttled by the shared request budget.
      </p>

      <form method="get" className="panel" style={{ marginBlock: "1rem", display: "grid", gap: "0.6rem" }}>
        <label>
          Path
          <input name="path" defaultValue={sp.path ?? "/units"} className="field" inputMode="url" autoCapitalize="none" />
        </label>
        <label>
          Query (optional, e.g. limit=5&amp;offset=0)
          <input name="q" defaultValue={sp.q ?? ""} className="field" autoCapitalize="none" />
        </label>
        <button type="submit" className="btn">Fetch and inspect</button>
      </form>

      {input && "error" in input && <StateMessage tone="error" title="Cannot run that request" detail={input.error} />}

      {single && (
        <section className="panel" style={{ marginBlockEnd: "1rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>{single.path}</h2>
          {single.ok && single.shape ? (
            <>
              <p className="note">{headline(single.shape)} · {single.source} · {single.ms} ms</p>
              <details open><summary>Structure</summary><pre className="pre">{renderShape(single.shape)}</pre></details>
              <details><summary>Raw JSON (first {RAW_LIMIT} characters)</summary>
                <pre className="pre">{JSON.stringify(single.data, null, 1)?.slice(0, RAW_LIMIT)}</pre>
              </details>
            </>
          ) : (
            <p className="banner" role="alert">{single.error?.title}{single.error?.status ? ` (HTTP ${single.error.status})` : ""}</p>
          )}
        </section>
      )}

      <section className="panel">
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Endpoint availability</h2>
        {bulk ? (
          <table className="table">
            <thead><tr><th>Endpoint</th><th>Result</th><th>Shape</th></tr></thead>
            <tbody>
              {bulk.map((r) => (
                <tr key={r.path + JSON.stringify(r.query ?? {})}>
                  <td><code>{r.path}</code></td>
                  <td>{r.ok ? `OK (${r.source})` : `${r.error?.kind}${r.error?.status ? ` ${r.error.status}` : ""}`}</td>
                  <td>{r.shape ? headline(r.shape) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <p className="note">Probes {PROBE_ENDPOINTS.length} endpoints that need no parameters (one request each).</p>
            <Link className="btn" href="/diagnostics?all=1" style={{ display: "inline-block", textDecoration: "none" }}>Run availability check</Link>
          </>
        )}
      </section>

      <section className="panel" style={{ marginBlockStart: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Endpoints that need an id (automatic discovery)</h2>
        {idRun ? (
          <>
            <p className="note">
              Ids were read from list responses: {idRun.sources.map((s) => `${s.key} ${s.ok ? "ok" : "failed"}`).join(" · ")}.
            </p>
            <div className="tablewrap"><table className="table">
              <thead><tr><th>Endpoint</th><th>Id used</th><th>Result</th><th>Shape</th></tr></thead>
              <tbody>
                {idRun.probes.map((r) => (
                  <tr key={r.label + (r.id ?? "")}>
                    <td><code>{r.skipped ? r.label : r.path}</code></td>
                    <td><code>{r.id ?? "-"}</code></td>
                    <td>{r.skipped ? `Skipped: ${r.skipped}` : r.ok ? `OK (${r.source})` : `${r.error?.kind}${r.error?.status ? ` ${r.error.status}` : ""}: ${r.error?.title}`}</td>
                    <td>{r.shape ? headline(r.shape) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p className="note">
              Page {idRun.page} of {idRun.pages} ({idRun.total} endpoints). Each page stays inside the request budget; wait about a minute between pages.{" "}
              {idRun.page < idRun.pages ? <Link href={`/diagnostics?ids=1&page=${idRun.page + 1}`}>Next page</Link> : null}
            </p>
          </>
        ) : (
          <>
            <p className="note">Finds an id for every entity type from the list endpoints, then requests each detail endpoint once, 14 per page, inside the shared request budget.</p>
            <Link className="btn" href="/diagnostics?ids=1" style={{ display: "inline-block", textDecoration: "none" }}>Discover ids and check endpoints</Link>
          </>
        )}
      </section>
    </>
  );
}
