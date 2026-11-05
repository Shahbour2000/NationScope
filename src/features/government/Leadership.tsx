import Link from "next/link";
import { RemoteImage } from "@/features/entities/RemoteImage";
import { term, type Display } from "@/features/entities/display";
import { PinButton } from "@/features/pins/PinButton";
import type { Messages } from "@/i18n/messages";
import type { MemberDto } from "./CongressView";
import s from "./Leadership.module.css";

export interface Leader { role: string; dto: MemberDto }

/** Columns that avoid an orphan card: up to 4 in one row, otherwise two balanced rows. */
export const desktopCols = (n: number) => (n <= 3 ? Math.max(1, n) : n === 4 ? 2 : Math.ceil(n / 2));
/** Same idea for mid-width containers: at most 3 across, never an orphan. */
export const cappedCols = (n: number) => { const c = desktopCols(n); return c <= 3 ? c : n % 3 === 0 ? 3 : n % 2 === 0 ? 2 : 3; };
/** Narrow containers: pairs when the count is even, otherwise a single column. */
export const tabletCols = (n: number) => (n <= 2 ? Math.max(1, n) : n % 2 === 0 ? 2 : 1);

function Person({ p, role, size, d, m, g }: { p: MemberDto; role: string; size: number; d: Display; m: Messages; g: Messages["governmentPage"] }) {
  return (
    <>
      <span className={s.avatar}><RemoteImage src={p.avatar} size={size} round fallback={<span className="seat-fallback big" style={{ inlineSize: size, blockSize: size }}>{p.name.slice(0, 2).toUpperCase()}</span>} /></span>
      <div className={s.body}>
        <span className={s.role}>{term("role", role, d)}</span>
        <Link className={s.name} href={`/players/${encodeURIComponent(p.id)}`} dir="auto" title={p.name}>{p.name}</Link>
        <span className={s.meta}>{p.party && <span>{p.party.name}</span>}{p.level != null && <span>{g.level} {p.level}</span>}{p.sinceText && <span>{g.since} {p.sinceText}</span>}</span>
      </div>
      <span className={s.pin}><PinButton labels={m.pins} target={{ type: "player", id: p.id, name: p.name, image: p.avatar, href: `/players/${encodeURIComponent(p.id)}` }} /></span>
    </>
  );
}

/** President on top as a wide hero; the other offices in a grid sized to their number so no card is left alone on a row. */
export function Leadership({ leaders, d, m }: { leaders: Leader[]; d: Display; m: Messages }) {
  const g = m.governmentPage;
  const top = leaders.find((l) => l.role === "president") ?? null;
  const rest = leaders.filter((l) => l !== top);
  return (
    <div className={s.frame}><div className={s.wrap}>
      {top && <article className={s.pres}><Person p={top.dto} role={top.role} size={80} d={d} m={m} g={g} /></article>}
      {rest.length > 0 && (
        <div className={s.others} style={{ ["--cd" as string]: desktopCols(rest.length), ["--cm" as string]: cappedCols(rest.length), ["--ct" as string]: tabletCols(rest.length) }}>
          {rest.map((l) => <article key={`${l.role}-${l.dto.id}`} className={s.card} data-role={l.role}><Person p={l.dto} role={l.role} size={52} d={d} m={m} g={g} /></article>)}
        </div>
      )}
    </div></div>
  );
}
