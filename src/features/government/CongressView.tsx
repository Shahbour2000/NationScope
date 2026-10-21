"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PinButton } from "@/features/pins/PinButton";
import { RemoteImage } from "@/features/entities/RemoteImage";
import type { Messages } from "@/i18n/messages";
import { NO_PARTY_COLOR, PARTY_COLORS, groupByParty, layoutParliament } from "./parliament";

export interface MemberDto {
  id: string; name: string; level: number | null; sinceText: string | null; avatar: string | null; party: { id: string; name: string } | null;
}

const initials = (n: string) => n.trim().slice(0, 2).toUpperCase();

/**
 * Hemicycle of the actual Congress members, grouped by party. Seats are buttons: hover (mouse) previews, tap/click/Enter selects.
 * The member list below is the full, touch-friendly alternative (and the primary view on narrow screens).
 */
export function Parliament({ members, vacant, rulingId, labels, pinLabels }: { members: MemberDto[]; vacant: number; rulingId: string | null; labels: Messages["governmentPage"]; pinLabels: Messages["pins"] }) {
  const groups = useMemo(() => groupByParty(members, rulingId).map((g, i) => ({ ...g, color: g.key === "__none__" ? NO_PARTY_COLOR : PARTY_COLORS[i % PARTY_COLORS.length]! })), [members, rulingId]);
  const ordered = useMemo(() => groups.flatMap((g) => g.members.map((m) => ({ m, color: g.color }))), [groups]);
  const total = ordered.length + vacant;
  const layout = useMemo(() => layoutParliament(total), [total]);
  const [sel, setSel] = useState<number | null>(null);
  const picked = sel !== null ? ordered[sel] : null;
  const size = (layout.seatSize / 2) * 100;

  return (
    <div className="parl">
      <div className="hemi" role="group" aria-label={labels.congress} data-sparse={total <= 16}>
        {layout.seats.map((s, i) => {
          const pos = { left: `${((s.x + 1) / 2) * 100}%`, top: `${((1.04 - s.y) / 1.08) * 100}%`, width: `${size}%` } as const;
          const o = ordered[i];
          if (!o) return <span key={i} className="seat seat-vacant" style={pos} role="img" aria-label={`${labels.seatOf} ${i + 1}: ${labels.vacant}`} />;
          return (
            <button key={o.m.id} type="button" className="seat" style={{ ...pos, borderColor: o.color }} data-selected={sel === i}
              aria-label={`${o.m.name}${o.m.party ? `, ${o.m.party.name}` : ""}`} aria-pressed={sel === i}
              onClick={() => setSel(i)} onPointerEnter={(e) => { if (e.pointerType === "mouse") setSel(i); }} onFocus={() => setSel(i)}>
              <RemoteImage src={o.m.avatar} size={40} round fallback={<span className="seat-fallback" style={{ background: o.color }}>{initials(o.m.name)}</span>} />
            </button>
          );
        })}
        <div className="hemi-total"><strong>{total}</strong><span>{labels.seats}</span></div>
      </div>

      <div className="seat-card" aria-live="polite">
        {picked ? (
          <>
            <RemoteImage src={picked.m.avatar} size={56} round fallback={<span className="seat-fallback big" style={{ background: picked.color }}>{initials(picked.m.name)}</span>} />
            <div className="seat-info">
              <Link href={`/players/${encodeURIComponent(picked.m.id)}`} dir="auto"><strong>{picked.m.name}</strong></Link>
              <span className="kv">
                <span className="badge" data-tone="neutral" style={{ borderColor: picked.color }}>{picked.m.party?.name ?? labels.independent}</span>
                {picked.m.level != null && <span>{labels.level} {picked.m.level}</span>}
                {picked.m.sinceText && <span>{labels.since}: {picked.m.sinceText}</span>}
              </span>
            </div>
            <div className="seat-actions">
              <Link className="btn-ghost" href={`/players/${encodeURIComponent(picked.m.id)}`}>{labels.openProfile}</Link>
              <PinButton labels={pinLabels} target={{ type: "player", id: picked.m.id, name: picked.m.name, image: picked.m.avatar, href: `/players/${encodeURIComponent(picked.m.id)}` }} />
            </div>
          </>
        ) : <p className="empty-mini">{labels.hint}</p>}
      </div>

      <ul className="legend" aria-label={labels.legend}>
        {groups.map((g) => <li key={g.key}><span className="dot" style={{ background: g.color }} aria-hidden="true" />{g.name ?? labels.independent} <b>{g.members.length}</b></li>)}
        {vacant > 0 && <li><span className="dot dot-vacant" aria-hidden="true" />{labels.vacant} <b>{vacant}</b></li>}
      </ul>

      <details open className="member-list">
        <summary>{labels.memberList} ({ordered.length})</summary>
        {groups.map((g) => (
          <section key={g.key}>
            <h3><span className="dot" style={{ background: g.color }} aria-hidden="true" />{g.name ?? labels.independent} <span className="chip">{g.members.length}</span></h3>
            <ul className="mlist">
              {g.members.map((m) => (
                <li key={m.id}>
                  <Link className="ichip" href={`/players/${encodeURIComponent(m.id)}`}>
                    <RemoteImage src={m.avatar} size={32} round fallback={<span className="seat-fallback" style={{ background: g.color }}>{initials(m.name)}</span>} />
                    <span dir="auto">{m.name}</span>
                  </Link>
                  <span className="kv">{m.level != null && <span>{labels.level} {m.level}</span>}{m.sinceText && <span>{m.sinceText}</span>}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </details>
    </div>
  );
}
