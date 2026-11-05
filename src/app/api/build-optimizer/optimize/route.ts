import { NextResponse } from "next/server";
import { defaultImportDeps } from "@/lib/data/build-import";
import { parseOptimizeInput } from "@/features/build-optimizer/api-schema";
import { loadAndRun } from "@/features/build-optimizer/run";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const MAX_BODY = 60_000;

/** POST /api/build-optimizer/optimize: validates the request, re-imports the player through the existing data layer (cached upstream), applies the user's inputs and runs the engine. */
export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false, reason: "error", message: "Request too large.", details: [] }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: false, reason: "error", message: "Invalid JSON.", details: [] }, { status: 400 }); }
  const parsed = parseOptimizeInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, reason: "missing-input", message: "Some inputs are missing or invalid.", details: parsed.errors }, { status: 400 });
  try {
    const result = await loadAndRun(parsed.value.playerId, parsed.value, defaultImportDeps);
    if (!result.ok && result.reason === "not-found") return NextResponse.json({ ok: false, reason: "error", message: "Player not found.", details: [] }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, reason: "error", message: "The optimization could not be completed (the game API may be unavailable).", details: [] }, { status: 502 });
  }
}
