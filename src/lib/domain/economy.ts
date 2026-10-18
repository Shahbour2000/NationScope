import { z } from "zod";

/** Written from real production responses (tests/fixtures/real). Money fields are strings in 1/10,000 gold. */
const s = z.string();
const n = z.number();
const money = s.regex(/^-?\d+$/);

export const marketRowSchema = z.object({
  itemCode: s.min(1), currency: s.nullish(),
  bestAsk: money.nullish(), askQty: n.nullish(), bestBid: money.nullish(), bidQty: n.nullish(), last: money.nullish(),
}).passthrough();
export type MarketRow = z.infer<typeof marketRowSchema>;

export const tradeSchema = z.object({
  id: s, itemCode: s, price: money, qty: n, currency: s.nullish(), buyerType: s.nullish(), sellerType: s.nullish(), createdAt: s.nullish(),
}).passthrough();
export type Trade = z.infer<typeof tradeSchema>;

export const equipmentOfferSchema = z.object({
  offerId: s, price: money, sellerId: s.nullish(), sellerName: s.nullish(), createdAt: s.nullish(), itemId: s.nullish(),
  itemCode: s, rarity: s.nullish(), slot: s.nullish(), stats: z.record(s, n).nullish(), durability: n.nullish(),
}).passthrough();
export type EquipmentOffer = z.infer<typeof equipmentOfferSchema>;

export const floorRowSchema = z.object({ slot: s, rarity: s, low: money, offers: n }).passthrough();
export type FloorRow = z.infer<typeof floorRowSchema>;

export const companySchema = z.object({
  id: s.min(1), name: s, itemCode: s, regionId: s.nullish(), countryId: s.nullish(),
  storageLevel: n.nullish(), engineLevel: n.nullish(), breakRoomLevel: n.nullish(),
  investedMoney: money.nullish(), investedSteel: n.nullish(), workers: n.nullish(), createdAt: s.nullish(),
  owner: z.object({ id: s, username: s, avatarUrl: s.nullish() }).passthrough().nullish(),
  level: n.nullish(), points: s.nullish(), maxWorkers: n.nullish(),
}).passthrough();
export type Company = z.infer<typeof companySchema>;

export const statsRowSchema = z.object({ itemCode: s, companies: n, investedMoney: money.nullish(), investedSteel: n.nullish(), workers: n.nullish(), owners: n.nullish() }).passthrough();
export type StatsRow = z.infer<typeof statsRowSchema>;
export const statsTotalsSchema = z.object({ companies: n, investedMoney: money.nullish(), investedSteel: n.nullish(), workers: n.nullish() }).passthrough();

export const jobOfferSchema = z.object({
  offerId: s, companyId: s.nullish(), companyName: s.nullish(), itemCode: s, regionId: s.nullish(), countryId: s.nullish(),
  ownerId: s.nullish(), ownerName: s.nullish(), slots: n.nullish(), minLevel: n.nullish(), incomeTax: n.nullish(),
  grossPerPoint: money.nullish(), netPerPoint: money.nullish(), taxPerPoint: money.nullish(), moneyAvailable: z.boolean().nullish(), own: z.boolean().nullish(),
}).passthrough();
export type JobOffer = z.infer<typeof jobOfferSchema>;
