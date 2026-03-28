import { describe, expect, it } from "vitest";
import { pickDealCandidates } from "../src/deals/hot-candidates.js";
import type { ScrapedListing } from "../src/scrapers/types.js";

function listing(over: Partial<ScrapedListing>): ScrapedListing {
  return {
    source: "kijiji",
    url: "https://kijiji.ca/v/test-a",
    title: "2010 Toyota Corolla",
    priceCad: 7000,
    year: 2010,
    mileageKm: 120_000,
    transmissionText: "automatique",
    description: "Automatique, bon état",
    modelHint: "Corolla",
    ...over,
  };
}

describe("pickDealCandidates", () => {
  it("keeps HOT deals first by margin", () => {
    const a = listing({ priceCad: 7000, title: "Corolla 2010" });
    const b = listing({
      priceCad: 5000,
      title: "Civic 2012",
      url: "https://kijiji.ca/v/test-b",
      year: 2012,
    });
    const picked = pickDealCandidates([b, a], { maxItems: 5 });
    expect(picked.length).toBeGreaterThanOrEqual(1);
    expect(picked[0].isHotDeal || (picked[0].dealMarginPct ?? 0) >= 10).toBe(
      true
    );
  });
});
