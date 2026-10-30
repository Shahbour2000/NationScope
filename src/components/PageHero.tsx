import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

export interface HeroKpi { icon: IconName; label: string; value: ReactNode; tone?: "red" | "green" | "gold" | "purple"; hint?: ReactNode }

/** Shared page header for the data pages: kicker, title, one-line purpose, optional actions, and a KPI strip (static tiles, never links). */
export function PageHero({ icon, kicker, title, sub, actions, kpis }: { icon: IconName; kicker: string; title: string; sub?: ReactNode; actions?: ReactNode; kpis?: HeroKpi[] }) {
  return (
    <header className="pagehero">
      <div className="ph-top">
        <div className="ph-text">
          <span className="ph-kicker">{kicker}</span>
          <h1><Icon name={icon} size={26} />{title}</h1>
          {sub ? <p className="ph-sub">{sub}</p> : null}
        </div>
        {actions ? <div className="ph-actions">{actions}</div> : null}
      </div>
      {kpis && kpis.length > 0 ? (
        <div className="kpis" role="list">
          {kpis.map((k) => (
            <div className="kpi" role="listitem" key={k.label}>
              <span className="kpi-ico" data-tone={k.tone}><Icon name={k.icon} size={22} /></span>
              <span className="kpi-body"><span className="kpi-val">{k.value}</span><span className="kpi-label" title={k.label}>{k.label}</span>{k.hint ? <span className="kpi-hint">{k.hint}</span> : null}</span>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}

export const PanelSkeleton = ({ h = "7rem" }: { h?: string }) => <div className="panel" aria-hidden="true"><div className="skeleton" style={{ inlineSize: "40%" }} /><div className="skeleton" style={{ blockSize: h }} /></div>;
