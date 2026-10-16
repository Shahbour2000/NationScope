import Link from "next/link";
import { notFound } from "next/navigation";
import { tryGetConfig } from "@/lib/config/env";
import { ENVIRONMENTS } from "@/lib/config/environments";
import { StateMessage } from "@/components/StateMessage";
import { diagnosticsEnabled, parseExplorerInput, probe, probeAll } from "@/lib/diagnostics/probe";
import { headline, renderShape } from "@/lib/diagnostics/shape";

export const dynamic = "force-dynamic";

const RAW_LIMIT = 8000;

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; q?: string; all?: string }>;
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
            <p className="note">Probes 16 endpoints that need no parameters (about 16 requests).</p>
            <Link className="btn" href="/diagnostics?all=1" style={{ display: "inline-block", textDecoration: "none" }}>Run availability check</Link>
          </>
        )}
      </section>
    </>
  );
}
