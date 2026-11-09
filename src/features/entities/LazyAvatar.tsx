"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { RemoteImage } from "./RemoteImage";

/** One in-flight/finished request per player for the whole session, shared by every avatar of that player. */
const requests = new Map<string, Promise<string | null>>();
function fetchAvatar(id: string): Promise<string | null> {
  let p = requests.get(id);
  if (!p) {
    p = fetch(`/api/avatar/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((j: { avatar?: string | null } | null) => j?.avatar ?? null).catch(() => null);
    requests.set(id, p);
  }
  return p;
}

/** Round player avatar that is requested only once it is near the viewport. While loading, and when there is no image or it fails, the same user glyph as <Avatar> is shown. */
export function LazyAvatar({ playerId, size = 24, initial }: { playerId: string | null | undefined; size?: number; initial?: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [src, setSrc] = useState<string | null>(initial ?? null);
  useEffect(() => {
    if (!playerId || initial) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const load = () => { void fetchAvatar(playerId).then((u) => { if (!cancelled) setSrc(u); }); };
    if (typeof IntersectionObserver === "undefined") { load(); return () => { cancelled = true; }; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => { cancelled = true; io.disconnect(); };
  }, [playerId, initial]);
  const fb = <span className="img img-round img-fallback" style={{ inlineSize: size, blockSize: size }}><Icon name="user" size={Math.round(size * 0.6)} /></span>;
  return <span ref={ref} style={{ display: "inline-flex", flex: "none" }}><RemoteImage src={src} size={size} round fallback={fb} /></span>;
}
