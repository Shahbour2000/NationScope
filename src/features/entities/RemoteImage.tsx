"use client";

import { useCallback, useState, type ReactNode } from "react";

/** <img> that swaps to a fallback node if the file is missing, so a broken image never shows. */
export function RemoteImage({ src, size, round, fallback, alt = "", cls }: { src: string | null; size: number; round?: boolean; fallback: ReactNode; alt?: string; cls?: string }) {
  const [failed, setFailed] = useState(false);
  // A server-rendered <img> can fail before React attaches onError; check the element as soon as it mounts.
  const ref = useCallback((img: HTMLImageElement | null) => { if (img && img.complete && img.naturalWidth === 0) setFailed(true); }, []);
  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={src} alt={alt} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" className={cls ?? (round ? "img img-round" : "img")} onError={() => setFailed(true)} />
  );
}
