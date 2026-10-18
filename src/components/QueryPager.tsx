import Link from "next/link";

/** Previous/next links that keep the current filters. `hasNext` comes from the API (hasMore/nextOffset/row count). */
export function QueryPager({ path, params, offset, step, hasNext, prev, next }: { path: string; params: Record<string, string | undefined>; offset: number; step: number; hasNext: boolean; prev: string; next: string }) {
  const href = (o: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (o > 0) q.set("offset", String(o));
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  return (
    <div className="pager">
      {offset > 0 ? <Link href={href(Math.max(0, offset - step))}>{prev}</Link> : <span>{prev}</span>}
      {hasNext ? <Link href={href(offset + step)}>{next}</Link> : <span>{next}</span>}
    </div>
  );
}
