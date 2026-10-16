import { z } from "zod";

/** One row of GET /units, as observed on Main (2026-10-15). Optional fields are tolerated; unknown fields are kept out of the model. */
const rowSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    countryId: z.string().nullish(),
    joinPolicy: z.string().nullish(),
    logoUrl: z.string().nullish(),
    hqLevel: z.number().int().nullish(),
    hqStatus: z.string().nullish(),
    ownerId: z.string().nullish(),
    ownerName: z.string().nullish(),
    members: z.number().int().nullish(),
    capacity: z.number().int().nullish(),
    /** Integer string; kept as a string for transport, summed as BigInt. */
    damage: z.string().regex(/^\d+$/).nullish(),
  })
  .passthrough();

/** Serializable (client-safe) unit row. */
export interface UnitRow {
  id: string;
  name: string;
  countryId: string | null;
  joinPolicy: string | null;
  logoSrc: string | null;
  hqLevel: number | null;
  hqStatus: string | null;
  ownerId: string | null;
  ownerName: string | null;
  members: number | null;
  capacity: number | null;
  damage: string | null;
}

const MEDIA_PATH = /^\/media\/[A-Za-z0-9._/-]+$/;
const safeMedia = (p: string): boolean => MEDIA_PATH.test(p) && !p.split("/").some((seg) => seg === ".." || seg === ".");

export function parseUnits(raw: readonly unknown[], origin: string): { units: UnitRow[]; skipped: number } {
  const units: UnitRow[] = [];
  let skipped = 0;
  for (const item of raw) {
    const r = rowSchema.safeParse(item);
    if (!r.success) {
      skipped++;
      continue;
    }
    const v = r.data;
    units.push({
      id: v.id,
      name: v.name,
      countryId: v.countryId ?? null,
      joinPolicy: v.joinPolicy ?? null,
      logoSrc: v.logoUrl && safeMedia(v.logoUrl) ? `${origin}${v.logoUrl}` : null,
      hqLevel: v.hqLevel ?? null,
      hqStatus: v.hqStatus ?? null,
      ownerId: v.ownerId ?? null,
      ownerName: v.ownerName ?? null,
      members: v.members ?? null,
      capacity: v.capacity ?? null,
      damage: v.damage ?? null,
    });
  }
  return { units, skipped };
}
