import { runMandatoryFiveFilters } from "../filters/mandatory-five.js";
import { scoreListingDeal } from "../scoring/deal-score.js";
import type { ScrapedListing } from "../scrapers/types.js";

export type DealCandidate = {
  listing: ScrapedListing;
  median: number | null;
  isHotDeal: boolean;
  dealMarginPct: number | null;
  /** HOT = ≥15% sous médiane (PRICE_MATRIX); sinon marge minimale configurable */
  potentialLabel: "hot" | "fort_potentiel";
};

/**
 * Annonces qui passent les 5 filtres + forte probabilité de bon deal (médiane connue).
 */
export function pickDealCandidates(
  listings: ScrapedListing[],
  options: { minMarginPct?: number; maxItems?: number } = {}
): DealCandidate[] {
  const minMargin = options.minMarginPct ?? 10;
  const maxItems = options.maxItems ?? 5;
  const out: DealCandidate[] = [];

  for (const listing of listings) {
    const f = runMandatoryFiveFilters(listing);
    if (!f.ok) continue;

    const d = scoreListingDeal(listing);
    if (d.median == null) continue;

    const margin = d.dealMarginPct ?? 0;
    if (d.isHotDeal) {
      out.push({
        listing,
        median: d.median,
        isHotDeal: true,
        dealMarginPct: d.dealMarginPct,
        potentialLabel: "hot",
      });
      continue;
    }
    if (margin >= minMargin) {
      out.push({
        listing,
        median: d.median,
        isHotDeal: false,
        dealMarginPct: d.dealMarginPct,
        potentialLabel: "fort_potentiel",
      });
    }
  }

  out.sort((a, b) => (b.dealMarginPct ?? 0) - (a.dealMarginPct ?? 0));
  return out.slice(0, maxItems);
}
