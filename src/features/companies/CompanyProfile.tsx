import Link from "next/link";
import { formatDuration, humanizeCode } from "@/lib/format";
import { itemName, type Display } from "@/features/entities/display";
import { ItemChip, PlayerChip } from "@/features/entities/entities";
import type { Messages } from "@/i18n/messages";
import { msUntilFull, readOffer, readUpgrades, readWorkers, storageFill, type CompanyDetail } from "@/lib/domain/company-detail";
import s from "../regions/region.module.css"; // shared panel / track / badge / facts styles

const pick = (dict: Record<string, string>, code: string) => dict[code] ?? humanizeCode(code.replace(/[._]+/g, " "));

/** Company profile body. Everything shown comes from GET /companies/{id}; only the fill percentage and time-to-full are computed. */
export function CompanyProfile({ company: c, d, m, nowMs }: { company: CompanyDetail; d: Display; m: Messages; nowMs: number }) {
  const t = m.companyPage, nf = new Intl.NumberFormat(d.nl);
  const p = c.production ?? null;
  const fill = storageFill(p), left = msUntilFull(p, nowMs);
  const needs = Object.entries(p?.needs ?? {});
  const bonuses = c.bonuses ?? [];
  const up = readUpgrades(c.upgrades), wk = readWorkers(c.workers), offer = readOffer(c.offer);
  const taxPct = p?.tax?.percent ?? null, carry = p?.tax?.carryUnits ?? null;
  const pct1 = new Intl.NumberFormat(d.nl, { maximumFractionDigits: 1 });
  const num = (v: number | null | undefined) => (v == null ? "—" : nf.format(v));
  const big = (v: string | null | undefined) => (v && /^\d+$/.test(v) ? nf.format(BigInt(v)) : "—");
  return (
    <div className={s.grid}>
      <section className={`panel ${s.panel} ${s.wide}`}>
        <h2>{t.production}</h2>
        {p ? (
          <>
            <div className={s.cardHead}>
              <div className={s.bigNum}>{fill === null ? "—" : `${pct1.format(fill)}%`}<small>{t.stored}</small></div>
              {p.full ? <span className={s.badge} data-tone="gold">{t.full}</span> : left !== null ? <span className={s.badge}>{t.fullIn.replace("{t}", formatDuration(left, d.m.time))}</span> : null}
            </div>
            {fill !== null ? <div className={s.track} data-kind="store" data-full={p.full === true} role="img" aria-label={`${Math.round(fill)}%`}><i style={{ inlineSize: `${fill}%` }} /></div> : null}
            <p className={s.dim}>{big(p.points)} / {big(p.capacity)}</p>
            <dl className={s.facts}>
              {p.enginePerDay != null ? <><dt>{t.perDay}</dt><dd>{num(p.enginePerDay)}</dd></> : null}
              {p.pointsPerUnit != null ? <><dt>{t.pointsPerUnit}</dt><dd>{num(p.pointsPerUnit)}</dd></> : null}
              <dt>{t.needs}</dt>
              <dd>{needs.length === 0 ? t.rawMaterial : <span className={s.cardMeta}>{needs.map(([code, q]) => <span key={code} className={s.versus}>{nf.format(q)} × <ItemChip code={code} d={d} href={`/market/${encodeURIComponent(code)}`} /></span>)}</span>}</dd>
              {taxPct != null ? <><dt>{t.tax}</dt><dd>{nf.format(taxPct)}%{carry ? <span className={s.dim}> · {nf.format(carry)} {t.unitsShort} {t.taxCarry}</span> : null}</dd></> : null}
            </dl>
            <p className={s.note}>{t.storageNote}</p>
          </>
        ) : <p className={s.note}>—</p>}
      </section>

      <section className={`panel ${s.panel}`}>
        <h2>{t.bonuses}</h2>
        {bonuses.length === 0 ? <p className={s.note}>{t.noBonuses}</p> : (
          <>
            <ul className={s.rows}>{bonuses.map((b, i) => <li key={`${b.source}-${i}`}><span title={b.source}>{pick(t.bonusSource as Record<string, string>, b.source)}</span><b>+{nf.format(b.percent)}%</b></li>)}</ul>
            {c.bonusTotal != null ? <p className={s.bigNum}>+{nf.format(c.bonusTotal)}%<small>{t.bonusTotal}</small></p> : null}
            <p className={s.note}>{t.bonusNote}</p>
          </>
        )}
      </section>

      <section className={`panel ${s.panel}`}>
        <h2>{t.workers}</h2>
        <div className={s.cardHead}>
          <span className={s.bigNum}>{nf.format(c.workers?.length ?? 0)}</span>
          <span className={s.badge} data-tone={offer.open ? "ok" : undefined}>{offer.open ? t.hiring : t.notHiring}</span>
        </div>
        {offer.open ? <dl className={s.facts}>{offer.slots != null ? <><dt>{t.slots}</dt><dd>{num(offer.slots)}</dd></> : null}{offer.minLevel != null ? <><dt>{t.minLevel}</dt><dd>{num(offer.minLevel)}</dd></> : null}</dl> : null}
        {c.hiresToday != null && c.hiresToday > 0 ? <p className={s.note}>{t.hiresToday}: {nf.format(c.hiresToday)}</p> : null}
        {wk.rows.length === 0 && wk.unreadable === 0 ? <p className={s.note}>{t.noWorkers}</p> : <ul className={s.chips}>{wk.rows.map((w, i) => <li key={`${w.id ?? w.username}-${i}`}><PlayerChip id={w.id} name={w.username} avatar={w.avatarUrl} d={d} /></li>)}</ul>}
        {wk.unreadable > 0 ? <p className={s.note}>{t.workersUnread.replace("{n}", nf.format(wk.unreadable))}</p> : null}
        <p className={s.note}><Link href="/jobs">{t.openJobs}</Link></p>
      </section>

      <section className={`panel ${s.panel} ${s.wide}`}>
        <h2>{t.upgrades}</h2>
        {up.rows.length === 0 ? <p className={s.note}>{t.noUpgrades}</p> : (
          <ul className={s.rows}>
            {up.rows.map((u) => {
              const cur = Object.entries(u.stats ?? {})[0];
              const nxt = u.next ?? null, nextStat = Object.entries(nxt?.stats ?? {})[0];
              const lvl = u.level ?? null, max = u.maxLevel ?? null;
              return (
                <li key={u.code}>
                  <span><b>{pick(t.upgradeName as Record<string, string>, u.code)}</b> <span className={s.dim}>{t.level} {num(lvl)}{max ? ` / ${nf.format(max)}` : ""}{cur ? ` · ${pick(t.statName as Record<string, string>, cur[0])}: ${nf.format(cur[1])}` : ""}</span></span>
                  <span className={s.dim}>{nxt ? <>{t.next}: {nxt.steelCost != null ? `${nf.format(nxt.steelCost)} ${t.steel}` : ""}{nxt.constructionCost != null && nxt.constructionResource ? ` + ${nf.format(nxt.constructionCost)} ${itemName(nxt.constructionResource, d)}` : ""}{nextStat ? ` → ${nf.format(nextStat[1])}` : ""}</> : t.maxLevel}</span>
                  {lvl !== null && max ? <span className={`${s.track} ${s.sub}`} data-kind="level" role="img" aria-label={`${lvl}/${max}`}><i style={{ inlineSize: `${Math.min(100, (lvl / max) * 100)}%` }} /></span> : null}
                  {u.canDowngrade && u.downgradeRefundSteel != null ? <span className={`${s.dim} ${s.sub}`}>{t.refund}: {nf.format(u.downgradeRefundSteel)}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
        {up.skipped > 0 ? <p className={s.note}>{t.unreadUpgrades.replace("{n}", nf.format(up.skipped))}</p> : null}
      </section>
    </div>
  );
}
