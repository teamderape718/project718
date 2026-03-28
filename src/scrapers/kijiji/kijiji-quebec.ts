import type { Page } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { ScrapedListing } from "../types.js";
import { extractPhoneFromListingPage } from "./phone-extract.js";
import { KIJIJI_SELECTORS } from "./selectors.js";
import { delay } from "./timing.js";

chromium.use(StealthPlugin());

export type ScrapeKijijiOptions = {
  startUrl: string;
  maxPages: number;
  headless: boolean;
  applyPrivateFilter: boolean;
  /** Visit each listing for full description (slower, better filter accuracy) */
  fetchListingDetails?: boolean;
};

const NAV_TIMEOUT_MS = 45_000;

function absUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

async function clickIfVisible(page: Page, selectors: readonly string[]): Promise<boolean> {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      if (await loc.isVisible({ timeout: 2000 })) {
        await loc.click();
        await delay(800);
        return true;
      }
    } catch {
      /* continue */
    }
  }
  return false;
}

async function applyPrivateSellerFilter(page: Page): Promise<void> {
  await clickIfVisible(page, [...KIJIJI_SELECTORS.filterPanelToggle]);
  const clicked = await clickIfVisible(page, [...KIJIJI_SELECTORS.privateSellerFilter]);
  if (clicked) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await delay(1200);
  }
}

function parseYear(text: string): number | null {
  const m = text.match(/\b((?:19|20)\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 1980 || y > 2035) return null;
  return y;
}

function parseKm(text: string): number | null {
  const normalized = text.replace(/\u00a0/g, " ");
  const m = normalized.match(/([\d\s]+)\s*km\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parsePriceCad(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function inferTransmission(cardText: string): string | null {
  const t = cardText.toLowerCase();
  if (t.includes("automatique") || t.includes("automatic") || /\bauto\b/i.test(cardText)) {
    return "automatic";
  }
  if (t.includes("manuel") || t.includes("manual") || t.includes("std")) {
    return "manual";
  }
  return null;
}

async function extractCards(page: Page, baseUrl: string): Promise<ScrapedListing[]> {
  const results: ScrapedListing[] = [];
  const seen = new Set<string>();

  for (const cardSel of KIJIJI_SELECTORS.listingCard) {
    const cards = page.locator(cardSel);
    const count = await cards.count();
    if (count === 0) continue;

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      let href: string | null = null;
      for (const linkSel of KIJIJI_SELECTORS.titleLink) {
        const link = card.locator(linkSel).first();
        if (await link.count()) {
          const h = await link.getAttribute("href");
          if (h) {
            href = absUrl(h, baseUrl);
            break;
          }
        }
      }
      if (!href || !href.includes("kijiji.ca")) continue;
      if (seen.has(href)) continue;
      seen.add(href);

      const cardText = (await card.innerText().catch(() => "")) || "";
      let title = cardText.split("\n").map((s) => s.trim()).find(Boolean) ?? "";
      for (const linkSel of KIJIJI_SELECTORS.titleLink) {
        const link = card.locator(linkSel).first();
        if (await link.count()) {
          const lt = await link.innerText().catch(() => "");
          if (lt?.trim()) {
            title = lt.trim();
            break;
          }
        }
      }

      let priceStr = "";
      for (const pSel of KIJIJI_SELECTORS.price) {
        const p = card.locator(pSel).first();
        if (await p.count()) {
          priceStr = (await p.innerText().catch(() => "")) || "";
          if (priceStr) break;
        }
      }
      if (!priceStr) {
        const pm = cardText.match(/\$\s*[\d\s,]+|[\d\s,]+\s*\$/);
        if (pm) priceStr = pm[0];
      }

      const year = parseYear(title + " " + cardText);
      const mileageKm = parseKm(cardText);
      const priceCad = parsePriceCad(priceStr);
      const transmissionText = inferTransmission(cardText);

      results.push({
        source: "kijiji",
        url: href,
        title,
        priceCad,
        year,
        mileageKm,
        transmissionText,
        description: cardText.slice(0, 8000),
        modelHint: title,
      });
    }

    if (results.length) break;
  }

  return results;
}

async function enrichWithDetailPage(
  page: Page,
  listings: ScrapedListing[],
  options: { capturePhone?: boolean } = {}
): Promise<void> {
  const capturePhone = options.capturePhone ?? true;
  for (const listing of listings) {
    try {
      await page.goto(listing.url, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
      await delay(400);
      const body = page.locator("body");
      const fullText = (await body.innerText().catch(() => "")) || "";
      listing.description = fullText.slice(0, 50_000);
      const attr = page.locator('[itemprop="vehicleTransmission"], [data-attribute="transmission"]');
      if (await attr.count()) {
        const tx = await attr.first().innerText().catch(() => "");
        if (tx?.trim()) listing.transmissionText = tx.trim();
      }
      if (capturePhone) {
        listing.sellerPhoneE164 = await extractPhoneFromListingPage(page);
      }
    } catch {
      /* keep card snippet */
    }
  }
}

/**
 * Ouvre un navigateur dédié pour enrichir description + téléphone (ex. top deals Telegram).
 */
export async function enrichListingsWithDetails(
  listings: ScrapedListing[],
  headless: boolean
): Promise<void> {
  if (!listings.length) return;
  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    locale: "fr-CA",
    timezoneId: "America/Montreal",
    viewport: { width: 1365, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  try {
    await enrichWithDetailPage(page, listings, { capturePhone: true });
  } finally {
    await browser.close();
  }
}

async function goToNextPage(page: Page): Promise<boolean> {
  for (const sel of KIJIJI_SELECTORS.nextPage) {
    const next = page.locator(sel).first();
    try {
      if (await next.isVisible({ timeout: 2000 })) {
        const cls = (await next.getAttribute("class")) ?? "";
        if (cls.includes("disabled") || cls.includes("inactive")) continue;
        await next.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await delay(1500);
        return true;
      }
    } catch {
      /* try next selector */
    }
  }
  return false;
}

export async function scrapeKijijiQuebec(
  options: ScrapeKijijiOptions
): Promise<ScrapedListing[]> {
  const {
    startUrl,
    maxPages,
    headless,
    applyPrivateFilter,
    fetchListingDetails = false,
  } = options;

  const browser = await chromium.launch({
    headless,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    locale: "fr-CA",
    timezoneId: "America/Montreal",
    viewport: { width: 1365, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  const all: ScrapedListing[] = [];
  const globalSeen = new Set<string>();

  try {
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    await delay(1500);

    if (applyPrivateFilter) {
      await applyPrivateSellerFilter(page);
    }

    for (let p = 0; p < maxPages; p++) {
      await delay(800);
      const batch = await extractCards(page, page.url());
      for (const item of batch) {
        if (!globalSeen.has(item.url)) {
          globalSeen.add(item.url);
          all.push(item);
        }
      }

      if (p < maxPages - 1) {
        const moved = await goToNextPage(page);
        if (!moved) break;
      }
    }

    if (fetchListingDetails && all.length) {
      await enrichWithDetailPage(page, all, { capturePhone: true });
    }
  } finally {
    await browser.close();
  }

  return all;
}
