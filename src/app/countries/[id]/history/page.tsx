import { permanentRedirect } from "next/navigation";

/** Legacy URL: the World events tab lives at /countries/{id}/events. Query (type, cursor) is preserved. */
export default async function LegacyHistoryRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (v && (k === "type" || k === "cursor")) q.set(k, v);
  permanentRedirect(`/countries/${encodeURIComponent(id)}/events${q.size ? `?${q}` : ""}`);
}
