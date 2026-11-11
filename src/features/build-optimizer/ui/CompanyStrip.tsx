"use client";
import type { ImportVM } from "../view-model";
import { fmt } from "./format";
import type { BuilderMessages } from "./messages";

/**
 * Read-only company tiles. The engine takes companies from the imported profile (GET /players/{id}/companies) and keeps enough company
 * slots for them on its own; there is no input to choose a company count, and empty "slots" are not drawn because the per-level slot
 * values are not confirmed. These tiles are information, deliberately not buttons.
 */
export function CompanyStrip({ t, numLocale, imp }: { t: BuilderMessages; numLocale: string; imp: ImportVM }) {
  const d = t.data; const c = imp.companies;
  return (
    <section className="card bo-companies" aria-labelledby="bo-companies">
      <h2 id="bo-companies">{d.companiesTitle}{c.count !== null ? <span className="bo-pin-points"> · {fmt(c.count, numLocale)}</span> : null}</h2>
      {c.count === null ? <p className="note">{d.companiesUnknown}</p> : c.count === 0 ? <p className="note">{d.companiesNone}</p> : (
        <ul className="bo-tiles bo-tiles-static">
          {c.products.map((p) => <li key={p.code} className="bo-tile" data-static="true"><span className="bo-tile-name">{p.code}</span><span className="bo-tile-val">× {fmt(p.count, numLocale)}{p.modelled ? "" : ` · ${d.companiesNotModelled}`}</span></li>)}
        </ul>
      )}
      <p className="hint">{d.companiesNote}</p>
    </section>
  );
}
