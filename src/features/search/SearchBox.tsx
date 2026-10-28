"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { RemoteImage } from "@/features/entities/RemoteImage";
import type { Messages } from "@/i18n/messages";
import type { Suggestion } from "./rank";

const TYPE_ICON: Record<string, IconName> = { country: "flag", player: "user", alliance: "shield", party: "landmark", unit: "unit" };
type State = "idle" | "loading" | "ready" | "error";

/** Combobox with live suggestions. Late responses are ignored (request ids + AbortController); works without JS as a plain GET form to /search. */
export function SearchBox({ labels }: { labels: Messages["search"] }) {
  const router = useRouter();
  const uid = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [state, setState] = useState<State>("idle");
  const [partial, setPartial] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLFormElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { reqId.current++; setItems([]); setState("idle"); return; }
    const id = ++reqId.current;
    const ctl = new AbortController();
    setState("loading");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        const body = (await res.json()) as { results?: Suggestion[]; partial?: boolean };
        if (id !== reqId.current) return; // a newer query already took over
        if (!res.ok) { setItems([]); setState("error"); return; }
        setItems(body.results ?? []); setPartial(Boolean(body.partial)); setActive(-1); setState("ready"); setOpen(true);
      } catch (e) {
        if ((e as Error).name === "AbortError" || id !== reqId.current) return;
        setItems([]); setState("error");
      }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (s: Suggestion) => { setOpen(false); setQ(""); router.push(s.href); };
  const showPanel = open && q.trim().length >= 2;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; } // preventDefault: <input type="search"> would otherwise clear the text
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === "Enter" && active >= 0 && items[active]) { e.preventDefault(); go(items[active]!); }
  };

  return (
    <form ref={box} role="search" action="/search" method="get" className="searchbox" onSubmit={() => setOpen(false)}>
      <Icon name="search" size={18} />
      <input name="q" type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey} onFocus={() => setOpen(true)}
        minLength={2} maxLength={60} placeholder={labels.placeholder} aria-label={labels.label} autoComplete="off"
        role="combobox" aria-expanded={showPanel} aria-controls={`${uid}-list`} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${uid}-o${active}` : undefined} />
      {showPanel && (
        <div className="sugg" id={`${uid}-list`} role="listbox" aria-label={labels.label}>
          {state === "loading" && items.length === 0 && <p className="sugg-msg" role="status">{labels.loading}</p>}
          {state === "error" && <p className="sugg-msg" role="alert">{labels.error}</p>}
          {state === "ready" && items.length === 0 && <p className="sugg-msg" role="status">{labels.noResults}</p>}
          {items.map((s, i) => (
            <div key={`${s.type}:${s.id}`} id={`${uid}-o${i}`} role="option" aria-selected={i === active} className="sugg-item" data-active={i === active}
              onMouseDown={(e) => e.preventDefault()} onClick={() => go(s)} onMouseEnter={() => setActive(i)}>
              <RemoteImage src={s.image} size={28} round={s.type !== "country"} cls={s.type === "country" ? "cflag-img" : "img img-round"}
                fallback={<span className="img img-round img-fallback" style={{ inlineSize: 28, blockSize: 28 }}><Icon name={TYPE_ICON[s.type] ?? "search"} size={14} /></span>} />
              <span className="sugg-text"><span className="sugg-name" dir="auto" title={s.name}>{s.name}</span>{s.sub ? <span className="sugg-sub" dir="auto">{s.sub}</span> : null}</span>
              <span className="sugg-type">{labels.types[s.type]}</span>
            </div>
          ))}
          {state === "ready" && items.length > 0 && partial && <p className="sugg-msg sugg-note">{labels.partial}</p>}
          <button type="submit" className="sugg-all">{labels.seeAll} “{q.trim()}”</button>
        </div>
      )}
    </form>
  );
}
