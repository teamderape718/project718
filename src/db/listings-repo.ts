import type pg from "pg";
import type { ScrapedListing } from "../scrapers/types.js";

export type ListingRow = {
  id: number;
  deal_notify_sent_at: Date | null;
};

export async function findListingByUrl(
  client: pg.Pool | pg.PoolClient,
  listingUrl: string
): Promise<ListingRow | null> {
  const r = await client.query<ListingRow>(
    `SELECT id, deal_notify_sent_at FROM listings WHERE listing_url = $1`,
    [listingUrl]
  );
  return r.rows[0] ?? null;
}

export async function upsertListing(
  client: pg.Pool | pg.PoolClient,
  listing: ScrapedListing
): Promise<{ id: number }> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO listings (source, listing_url, title, year, mileage_km)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (listing_url) DO UPDATE SET
       title = COALESCE(EXCLUDED.title, listings.title),
       year = COALESCE(EXCLUDED.year, listings.year),
       mileage_km = COALESCE(EXCLUDED.mileage_km, listings.mileage_km),
       last_seen_at = NOW()
     RETURNING id`,
    [
      listing.source,
      listing.url,
      listing.title,
      listing.year,
      listing.mileageKm,
    ]
  );
  const id = r.rows[0]?.id;
  if (id == null) throw new Error("upsertListing: missing id");
  return { id };
}

export async function insertPriceSnapshot(
  client: pg.Pool | pg.PoolClient,
  listingId: number,
  listing: ScrapedListing
): Promise<void> {
  await client.query(
    `INSERT INTO price_snapshots (listing_id, price_cad, title)
     VALUES ($1, $2, $3)`,
    [listingId, listing.priceCad, listing.title]
  );
}

export async function markDealNotified(
  client: pg.Pool | pg.PoolClient,
  listingId: number
): Promise<void> {
  await client.query(
    `UPDATE listings SET deal_notify_sent_at = NOW() WHERE id = $1`,
    [listingId]
  );
}

export function alreadyNotifiedForDeal(row: ListingRow | null): boolean {
  return row?.deal_notify_sent_at != null;
}
