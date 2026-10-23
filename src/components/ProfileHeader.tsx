import type { ReactNode } from "react";

export interface ProfileStat { label: string; value: ReactNode; hint?: ReactNode }

/**
 * Shared identity header for entity profiles (unit now; country/player/alliance/party can adopt it).
 * Sizing rules: the image never shrinks, the text column has min-width 0 so long names truncate (full name in the title attribute)
 * instead of pushing the layout, and stats flow in an auto-fit grid.
 */
export function ProfileHeader({ image, kicker, title, description, badges, actions, stats, statsLabel }: {
  image: ReactNode; kicker?: ReactNode; title: string; description?: string | null; badges?: ReactNode; actions?: ReactNode; stats?: ProfileStat[]; statsLabel?: string;
}) {
  return (
    <header className="phead">
      <div className="phead-img">{image}</div>
      <div className="phead-main">
        {kicker ? <div className="phead-kicker">{kicker}</div> : null}
        <h1 title={title} dir="auto">{title}</h1>
        {description ? <p className="phead-desc" dir="auto">{description}</p> : null}
        {(badges || actions) ? <div className="phead-actions">{badges}{actions}</div> : null}
      </div>
      {stats && stats.length > 0 ? (
        <dl className="phead-stats" aria-label={statsLabel}>
          {stats.map((s) => (
            <div key={s.label} className="pstat">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
              {s.hint ? <small>{s.hint}</small> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}
