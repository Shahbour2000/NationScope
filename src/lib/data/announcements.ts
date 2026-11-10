import { z } from "zod";
import { endpoints } from "@/lib/api/endpoints";
import { getApiClient } from "@/lib/api/instance";
import { anyJson } from "@/lib/api/schemas";
import { parseRows } from "@/lib/domain/parse";

const n = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]);
/** Verified against API/samples/countries/Announcements.txt: a top-level array of these objects. */
export const announcementSchema = z.object({
  id: z.string(), countryId: z.string().nullish(), authorId: z.string().nullish(), authorName: z.string().nullish(), body: z.string(),
  views: n.nullish(), createdAt: z.string().nullish(), expiresAt: z.string().nullish(), viewed: z.boolean().nullish(),
}).passthrough();
export type Announcement = z.infer<typeof announcementSchema>;

export function parseAnnouncements(data: unknown) {
  const arr = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray((data as { announcements?: unknown }).announcements) ? (data as { announcements: unknown[] }).announcements : null;
  const r = parseRows(arr ?? [], announcementSchema);
  return { rows: r.rows, skipped: r.skipped, recognised: arr !== null };
}

export async function getAnnouncements(countryId: string) {
  const e = endpoints.announcements(countryId);
  const { data, meta } = await getApiClient().get(e.path, { schema: anyJson, query: e.query });
  return { ...parseAnnouncements(data), meta };
}
