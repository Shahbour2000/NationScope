"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** <img> that swaps to a fallback node if the file is missing, so a broken image never shows. */
export function RemoteImage({ src, size, round, fallback, alt = "", cls }: { src: string | null; size: number; round?: boolean; fallback: ReactNode; alt?: string; cls?: string }) {
  const [failed, setFailed] = useState(false);
  // The fallback swap waits for `mounted`: an image that failed before hydration (its error event can be replayed during hydration)
  // must not change the output until hydration is done, otherwise React logs a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A server-rendered <img> can fail before React attaches onError. Check after hydration (an effect, not a ref callback, so hydration is never disturbed).
  useEffect(() => { setMounted(true); const img = ref.current; if (img && img.complete && img.naturalWidth === 0) setFailed(true); }, []);
  if (!src || (failed && mounted)) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={src} alt={alt} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" className={cls ?? (round ? "img img-round" : "img")} onError={() => setFailed(true)} />
  );
}
