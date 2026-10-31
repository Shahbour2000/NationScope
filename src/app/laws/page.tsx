import Link from "next/link";
import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { itemName } from "@/features/entities/display";
import { getDisplay } from "@/features/entities/display.server";
import { groupLaws } from "@/features/laws/categories";
import { getLocale, getMessages } from "@/i18n";
import { getLawsCatalog } from "@/lib/data/world";
import { humanizeCode } from "@/lib/format";
import type { LawDef } from "@/lib/domain/world";
import s from "./laws.module.css";

export const dynamic = "force-dynamic";

export default async function LawsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const scope = (await searchParams).scope === "alliance" ? "alliance" : (await searchParams).scope === "country" ? "country" : "all";
  const m = getMessages(await getLocale());
  const t = m.lawsPage;
  let res;
  try { res = await getLawsCatalog(); } catch (e) { return <><h1>{t.title}</h1><ApiErrorState error={e} retryLabel={m.common.retry} /></>; }
  const d = await getDisplay();
  const nf = new Intl.NumberFormat(d.nl);
  const unit = res.costItem ? itemName(res.costItem, d) : "";
  const laws = res.laws.filter((l) => scope === "all" || l.scope === scope);
  const war = laws.find((l) => l.code === "declare_war") ?? null;
  const related = ["propose_peace", "define_enemy_country"].map((c) => laws.find((l) => l.code === c)).filter((l): l is LawDef => !!l);
  const groups = groupLaws(laws.filter((l) => l !== war && !related.includes(l)));
  const cost = (l: LawDef) => (l.cost == null ? null : <><b>{nf.format(l.cost)}</b> {unit}</>);
  const target = (l: LawDef) => {
    const kinds = Object.values(l.params ?? {}).filter((v): v is string => typeof v === "string");
    return kinds.length ? kinds.map((k) => (t.param as Record<string, string>)[k] ?? humanizeCode(k)).join(", ") : null;
  };
  const name = (l: LawDef) => l.label ?? humanizeCode(l.code);
  const tabs: [string, string, string][] = [["all", "/laws", t.scopeAll], ["country", "/laws?scope=country", t.scopeCountry], ["alliance", "/laws?scope=alliance", t.scopeAlliance]];
  return (
    <>
      <div className="page-head"><h1><Icon name="contract" size={26} />{t.title}</h1></div>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.4rem", maxInlineSize: "62rem" }}>{t.intro}</p>
      <dl className={s.rules}>
        {res.voteHours != null && <div><dt>{t.voting}</dt><dd>{nf.format(res.voteHours)}{t.hours}</dd></div>}
        {res.answerHours != null && <div><dt>{t.answer}</dt><dd>{nf.format(res.answerHours)}{t.hours}</dd></div>}
        {res.maxTax != null && <div><dt>{t.maxTax}</dt><dd>{nf.format(res.maxTax)}%</dd></div>}
      </dl>
      <nav className={s.tabs} aria-label={t.title}>
        {tabs.map(([k, href, label]) => <Link key={k} href={href} aria-current={scope === k ? "page" : undefined}>{label}</Link>)}
      </nav>
      {laws.length === 0 && <p className={s.empty}>{t.noLaws}</p>}
      {war && (
        <section className={s.spot} aria-label={t.featured}>
          <article className={s.hero}>
            <span className={s.kicker}>{t.featured}</span>
            <h2>{name(war)}</h2>
            {war.description && <p>{war.description}</p>}
            <div className={s.meta}>
              {cost(war) && <span>{t.cost} · {cost(war)}</span>}
              {target(war) && <span>{t.target} · <b>{target(war)}</b></span>}
            </div>
          </article>
          <div className={s.side}>
            {related.map((l) => (
              <article key={l.code} className={s.row}>
                <h3>{name(l)}</h3>
                {l.description && <p>{l.description}</p>}
                <small>{[cost(l) ? <span key="c">{t.cost} · {cost(l)}</span> : null, l.bilateral ? <span key="b"> · {t.needsAgreement}</span> : null]}</small>
              </article>
            ))}
          </div>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.category} className={s.section}>
          <h2>{t.cat[g.category]}</h2>
          <div className={s.grid}>
            {g.laws.map((l) => (
              <article key={l.code} className={s.card}>
                <h3>{name(l)}</h3>
                {l.description && <p>{l.description}</p>}
                <div className={s.foot}>
                  <span>{cost(l) ? <>{t.cost} · {cost(l)}</> : null}</span>
                  <span>{l.bilateral ? t.needsAgreement : target(l) ? `${t.target} · ${target(l)}` : ""}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
