import { createHash } from "node:crypto";
import type { ScrapedListing } from "../scrapers/types.js";

export type CachedDeal = {
  listing: ScrapedListing;
  median: number | null;
  dealMarginPct: number | null;
  potentialLabel: string;
};

const store = new Map<string, CachedDeal>();
const expiresAt = new Map<string, number>();

const TTL_MS = 60 * 60 * 1000;

export function shortDealId(url: string): string {
  return createHash("sha256").update(url).digest("base64url").slice(0, 12);
}

export function putDeal(id: string, deal: CachedDeal): void {
  store.set(id, deal);
  expiresAt.set(id, Date.now() + TTL_MS);
}

export function getDeal(id: string): CachedDeal | null {
  const exp = expiresAt.get(id);
  if (exp != null && Date.now() > exp) {
    store.delete(id);
    expiresAt.delete(id);
    return null;
  }
  return store.get(id) ?? null;
}
