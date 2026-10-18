"use client";

import { useState, type ReactNode } from "react";

/** <img> that swaps to a fallback node if the file is missing, so a broken image never shows. */
export function RemoteImage({ src, size, round, fallback, alt = "" }: { src: string | null; size: number; round?: boolean; fallback: ReactNode; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={size} height={size} loading="lazy" referrerPolicy="no-referrer" className={round ? "img img-round" : "img"} onError={() => setFailed(true)} />
  );
}
