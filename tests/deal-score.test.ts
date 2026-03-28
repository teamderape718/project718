import { describe, expect, it } from "vitest";
import { scoreListingDeal } from "../src/scoring/deal-score.js";
import type { ScrapedListing } from "../src/scrapers/types.js";

describe("deal-score", () => {
  it("flags hot deal for known model below 85% median", () => {
    const listing: ScrapedListing = {
      source: "kijiji",
      url: "https://kijiji.ca/x",
      title: "Toyota Corolla 2010",
      priceCad: 7000,
      year: 2010,
      mileageKm: 100_000,
      transmissionText: "auto",
      description: "Automatique",
      modelHint: "Toyota Corolla",
    };
    const s = scoreListingDeal(listing);
    expect(s.median).toBe(8500);
    expect(s.isHotDeal).toBe(true);
    expect(s.dealMarginPct).toBeGreaterThan(15);
  });

  it("returns null median for unknown model", () => {
    const listing: ScrapedListing = {
      source: "kijiji",
      url: "https://kijiji.ca/x",
      title: "Ford Focus",
      priceCad: 3000,
      year: 2010,
      mileageKm: 100_000,
      transmissionText: "auto",
      description: "auto",
      modelHint: "Ford Focus",
    };
    const s = scoreListingDeal(listing);
    expect(s.median).toBeNull();
    expect(s.isHotDeal).toBe(false);
  });
});
