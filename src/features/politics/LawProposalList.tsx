import Link from "next/link";
import { countryName, type Display } from "@/features/entities/display";
import { Flag } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import type { LawProposal } from "@/lib/data/world";
import { formatDate, humanizeCode } from "@/lib/format";
import s from "@/features/countries/sub.module.css";

const safe = (v: string) => /^[A-Za-z0-9_-]{1,80}$/.test(v);

/** Law proposals with vote bars. Shared by country laws and alliance laws (both endpoints return the same proposal shape). */
export function LawProposalList({ proposals, label, status, t, d }: { proposals: LawProposal[]; label: (code: string) => string; status: (s: string | null | undefined) => string; t: Messages["countrySubs"]["laws"]; d: Display }) {
  const nf = new Intl.NumberFormat(d.nl);
  return (
  <ul className={s.list}>
    {proposals.map((p) => {
      const voters = p.electorateSize ?? 0;
      const yes = p.yes ?? 0, no = p.no ?? 0;
      const pct = (n: number) => (voters > 0 ? Math.min(100, (n / voters) * 100) : 0);
      const entries = Object.entries(p.params ?? {});
      return (
        <li key={p.id} className={s.row}>
          <div>
            <div className={s.title}>
              {safe(p.id) ? <Link href={`/laws/${encodeURIComponent(p.id)}`}>{label(p.lawCode)}</Link> : <b>{label(p.lawCode)}</b>}
              {entries.map(([k, v]) => (k === "country" && typeof v === "string"
                ? (safe(v) ? <Link key={k} href={`/countries/${encodeURIComponent(v)}`} className={s.chip}><Flag id={v} d={d} />{countryName(v, d.dir)}</Link> : <span key={k} className={s.chip}><Flag id={v} d={d} />{countryName(v, d.dir)}</span>)
                : <span key={k} className={s.chip}>{humanizeCode(String(v))}</span>))}
              <span className={s.pill} data-s={p.status ?? undefined}>{status(p.status)}</span>
            </div>
            <span className={s.meta}>{p.proposerName ? <>{t.by} {p.proposerId && safe(p.proposerId) ? <Link href={`/players/${encodeURIComponent(p.proposerId)}`} dir="auto">{p.proposerName}</Link> : p.proposerName} · </> : ""}{formatDate(p.opensAt, d.nl) ?? ""}{p.paperCost != null ? ` · ${nf.format(p.paperCost)} ${t.cost}` : ""}</span>
            {p.failureReason ? <span className={s.meta} dir="auto"> · {p.failureReason}</span> : null}
          </div>
          <div className={s.votes} aria-label={`${yes} ${t.yes}, ${no} ${t.no}`}>
            <div className={s.votebar}><i style={{ inlineSize: `${pct(yes)}%` }} /><i style={{ inlineSize: `${pct(no)}%` }} /></div>
            <span className={s.votenums}>{nf.format(yes)} {t.yes} · {nf.format(no)} {t.no}{voters ? ` · ${nf.format(voters)} ${t.voters}` : ""}</span>
          </div>
        </li>
      );
    })}
  </ul>
  );
}
