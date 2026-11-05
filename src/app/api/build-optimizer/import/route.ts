import { NextResponse } from "next/server";
import { importPlayerForBuild } from "@/lib/data/build-import";
import { importViewModel } from "@/features/build-optimizer/view-model";

export const dynamic = "force-dynamic";
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** GET /api/build-optimizer/import?player=<id>: "Import Profile". Reuses the existing data layer (and its cache and rate limits); returns what is known, with provenance, and what is not. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("player") ?? "";
  if (!SAFE_ID.test(id)) return NextResponse.json({ ok: false, error: "invalid player id" }, { status: 400 });
  try {
    const imp = await importPlayerForBuild(id);
    if (!imp) return NextResponse.json({ ok: false, error: "player not found" }, { status: 404 });
    return NextResponse.json({ ok: true, import: importViewModel(imp) });
  } catch {
    return NextResponse.json({ ok: false, error: "The game API could not be reached." }, { status: 502 });
  }
}
