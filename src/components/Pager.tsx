import Link from "next/link";

export function Pager({ basePath, offset, pageSize, rowCount, prev, next }: { basePath: string; offset: number; pageSize: number; rowCount: number; prev: string; next: string }) {
  const hasNext = rowCount >= pageSize && offset + pageSize <= 10000;
  return (
    <div className="pager">
      {offset > 0 ? <Link href={`${basePath}?offset=${Math.max(0, offset - pageSize)}`}>{prev}</Link> : <span>{prev}</span>}
      {hasNext ? <Link href={`${basePath}?offset=${offset + pageSize}`}>{next}</Link> : <span>{next}</span>}
    </div>
  );
}
