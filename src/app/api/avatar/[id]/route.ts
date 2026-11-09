import { NextResponse } from "next/server";
import { getPlayerProfile } from "@/lib/data/players";

export const dynamic = "force-dynamic";
const TTL = 60 * 60_000, FAIL_TTL = 60_000;
const cache = new Map<string, { at: number; avatar: string | null }>();

/** Player avatar URL for lazy-loaded avatars (job offers etc.). One upstream profile request per player per hour per instance; failures are remembered for a minute. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return NextResponse.json({ avatar: null }, { status: 400 });
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < (hit.avatar ? TTL : FAIL_TTL)) return NextResponse.json({ avatar: hit.avatar }, { headers: { "cache-control": "private, max-age=300" } });
  try {
    const { player } = await getPlayerProfile(id);
    const avatar = player?.avatar ?? null;
    cache.set(id, { at: Date.now(), avatar });
    return NextResponse.json({ avatar }, { headers: { "cache-control": "private, max-age=300" } });
  } catch {
    cache.set(id, { at: Date.now(), avatar: null });
    return NextResponse.json({ avatar: null }, { status: 200 });
  }
}
