import { NextResponse } from "next/server";
import { describeError } from "@/lib/api/errors";
import { ConfigError, getConfig } from "@/lib/config/env";
import { getGameInfo } from "@/lib/data/game";

export const dynamic = "force-dynamic";

/** Reports which environment is selected and whether the upstream API answered. No secrets, no upstream bodies. */
export async function GET() {
  let config;
  try {
    config = getConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      return NextResponse.json({ ok: false, problem: "configuration", message: error.message }, { status: 500 });
    }
    throw error;
  }
  try {
    const { meta } = await getGameInfo();
    return NextResponse.json({ ok: true, environment: config.environment, host: meta.host, source: meta.source, fetchedAt: meta.fetchedAt });
  } catch (error) {
    const d = describeError(error);
    return NextResponse.json(
      { ok: false, environment: config.environment, problem: "upstream", message: d.title },
      { status: 502 },
    );
  }
}
