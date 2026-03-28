import { getMedianForModelYear, isHotDeal } from "../constants/price-matrix.js";
import type { ScrapedListing } from "../scrapers/types.js";

export type DealScore = {
  median: number | null;
  isHotDeal: boolean;
  dealMarginPct: number | null;
};

/**
 * Compare listing price to PRICE_MATRIX median. Hot deal = price &lt; median * 0.85.
 */
export function scoreListingDeal(listing: ScrapedListing): DealScore {
  const year = listing.year;
  const price = listing.priceCad;
  const model = listing.modelHint ?? listing.title;

  if (year == null || price == null) {
    return { median: null, isHotDeal: false, dealMarginPct: null };
  }

  const median = getMedianForModelYear(model, year);
  if (median == null) {
    return { median: null, isHotDeal: false, dealMarginPct: null };
  }

  const hot = isHotDeal(price, median);
  const dealMarginPct = ((median - price) / median) * 100;

  return {
    median,
    isHotDeal: hot,
    dealMarginPct: Number(dealMarginPct.toFixed(2)),
  };
}
