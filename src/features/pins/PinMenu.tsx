"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { RemoteImage } from "@/features/entities/RemoteImage";
import type { Messages } from "@/i18n/messages";
import { groupPins } from "./store";
import { usePins } from "./usePins";

const TYPE_ICON: Record<string, IconName> = { country: "flag", player: "user", alliance: "shield", party: "landmark", unit: "unit" };

/** Top-bar pin menu: a dropdown on desktop, a bottom sheet on phones. Items link to the entity and can be unpinned in place. */
export function PinMenu({ labels }: { labels: Messages["pins"] }) {
  const { pins, remove } = usePins();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const onDown = (e: MouseEvent) => { if (!panel.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);

  const groups = groupPins(pins);
  return (
    <div className="pinmenu">
      <button ref={trigger} type="button" className="icon-btn pin-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={`${labels.title} (${pins.length})`} onClick={() => setOpen((o) => !o)}>
        <Icon name="pin" size={20} />
        {pins.length > 0 && <span className="pin-count" aria-hidden="true">{pins.length > 99 ? "99+" : pins.length}</span>}
      </button>
      {open && <div className="pin-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && (
        <div ref={panel} className="pin-panel" role="dialog" aria-label={labels.title}>
          <div className="pin-head">
            <strong>{labels.title}</strong>
            <button type="button" className="icon-btn" aria-label={labels.close} onClick={() => { setOpen(false); trigger.current?.focus(); }}><Icon name="close" size={18} /></button>
          </div>
          {groups.length === 0 ? (
            <p className="pin-empty">{labels.empty}</p>
          ) : (
            <div className="pin-body">
              {groups.map((g) => (
                <section key={g.type} aria-label={labels.groups[g.type]}>
                  <h3>{labels.groups[g.type]} <span className="chip">{g.pins.length}</span></h3>
                  <ul>
                    {g.pins.map((p) => (
                      <li key={p.id}>
                        <Link href={p.href} className="pin-link">
                          <RemoteImage src={p.image} size={28} round={p.type !== "country"} cls={p.type === "country" ? "cflag-img" : "img img-round"} fallback={<span className="img img-round img-fallback" style={{ inlineSize: 28, blockSize: 28 }}><Icon name={TYPE_ICON[p.type] ?? "pin"} size={16} /></span>} />
                          <span className="pin-name" dir="auto">{p.name}</span>
                        </Link>
                        <button type="button" className="icon-btn" aria-label={`${labels.unpin}: ${p.name}`} onClick={() => remove(p.type, p.id)}><Icon name="close" size={16} /></button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <p className="pin-note">{labels.deviceNote}</p>
        </div>
      )}
    </div>
  );
}
