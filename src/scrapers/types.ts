export type ScrapedListing = {
  source: "kijiji";
  url: string;
  title: string;
  priceCad: number | null;
  year: number | null;
  mileageKm: number | null;
  /** Raw or inferred transmission text */
  transmissionText: string | null;
  description: string;
  /** Heuristic model string for matrix lookup */
  modelHint: string | null;
  sellerListingCount?: number;
  /** If scraped from listing detail (tel: / reveal) */
  sellerPhoneE164?: string | null;
};

export type ScrapedListingWithDeal = ScrapedListing & {
  median: number | null;
  isHotDeal: boolean;
  dealMarginPct: number | null;
};
