/**
 * Kijiji DOM changes often. Prefer data-testid / stable roles; extend fallbacks here.
 * @see https://www.kijiji.ca — verify after site updates.
 */

export const KIJIJI_SELECTORS = {
  /** Listing container (search results) */
  listingCard: [
    '[data-testid="listing-card"]',
    "article.search-item",
    "div[data-listing-id]",
    ".search-item",
  ],
  titleLink: ["a[data-testid='listing-link']", "a.search-item-link", "a[href*='/v-']"],
  price: [
    '[data-testid="listing-price"]',
    "p[data-testid='listing-price']",
    ".price",
  ],
  /** Attribute or sub-node for mileage — often in title or meta line */
  detailsLine: [".details", ".search-item-info", '[data-testid="listing-details"]'],
  nextPage: [
    'a[rel="next"]',
    'a[aria-label="Next"]',
    "a.pagination-next",
    "a:has-text('Suivant')",
  ],
  /** Filter: For sale by owner / Particulier */
  privateSellerFilter: [
    'button:has-text("Particulier")',
    'label:has-text("Particulier")',
    'span:has-text("Particulier")',
    'a:has-text("Particulier")',
    '[data-testid*="owner"]',
    'button:has-text("Owner")',
  ],
  filterPanelToggle: [
    'button:has-text("Filtres")',
    'button:has-text("Filters")',
    'button[aria-label*="ilter"]',
  ],
} as const;
