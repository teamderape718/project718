import { loadEnv } from "../config/env.js";
import { analyzeListingWithClaude } from "../ai/claude-listing-analyze.js";
import {
  passesGroqThreshold,
  quickScoreWithGroq,
} from "../ai/groq-quick-score.js";
import {
  alreadyNotifiedForDeal,
  findListingByUrl,
  insertPriceSnapshot,
  markDealNotified,
  upsertListing,
} from "../db/listings-repo.js";
import { getPool } from "../db/pool.js";
import { runMandatoryFiveFilters } from "../filters/mandatory-five.js";
import { scoreListingDeal } from "../scoring/deal-score.js";
import { scrapeKijijiQuebec } from "../scrapers/kijiji/kijiji-quebec.js";
import type { ScrapedListing } from "../scrapers/types.js";
import { notifyDealToOwner } from "../services/telnyx-sms.js";

export type PipelineLeadResult = {
  listing: ScrapedListing;
  median: number | null;
  isHotDeal: boolean;
  dealMarginPct: number | null;
  action:
    | "skipped_filter"
    | "skipped_not_hot"
    | "skipped_claude"
    | "skipped_groq"
    | "skipped_duplicate_notify"
    | "notified"
    | "would_notify_no_sms_config"
    | "recorded_no_notify"
    | "hot_deal_no_database";
  claude?: { majorMechanicalOrPerforation: boolean; brief: string } | null;
  groq?: { score: number; note: string } | null;
};

export type RunKijijiCycleOptions = {
  maxPages: number;
  applyPrivateFilter: boolean;
  fetchListingDetails: boolean;
  sendOwnerSms: boolean;
};

export async function runKijijiCycle(
  opts: RunKijijiCycleOptions
): Promise<PipelineLeadResult[]> {
  const env = loadEnv();
  const listings = await scrapeKijijiQuebec({
    startUrl: env.KIJIJI_QUEBEC_AUTOS_URL,
    maxPages: opts.maxPages,
    headless: env.HEADLESS,
    applyPrivateFilter: opts.applyPrivateFilter,
    fetchListingDetails: opts.fetchListingDetails,
  });

  const pool = env.DATABASE_URL ? getPool() : null;
  const out: PipelineLeadResult[] = [];

  for (const listing of listings) {
    const filter = runMandatoryFiveFilters(listing);
    if (!filter.ok) {
      out.push({
        listing,
        median: null,
        isHotDeal: false,
        dealMarginPct: null,
        action: "skipped_filter",
      });
      continue;
    }

    const deal = scoreListingDeal(listing);
    if (!deal.isHotDeal) {
      out.push({
        listing,
        median: deal.median,
        isHotDeal: false,
        dealMarginPct: deal.dealMarginPct,
        action: "skipped_not_hot",
      });
      continue;
    }

    let claude: Awaited<ReturnType<typeof analyzeListingWithClaude>> = null;
    try {
      claude = await analyzeListingWithClaude(listing.description);
    } catch {
      claude = null;
    }
    if (claude?.majorMechanicalOrPerforation) {
      out.push({
        listing,
        median: deal.median,
        isHotDeal: true,
        dealMarginPct: deal.dealMarginPct,
        action: "skipped_claude",
        claude,
      });
      continue;
    }

    let groq: Awaited<ReturnType<typeof quickScoreWithGroq>> = null;
    try {
      groq = await quickScoreWithGroq({
        title: listing.title,
        description: listing.description,
        priceCad: listing.priceCad,
        year: listing.year,
      });
    } catch {
      groq = null;
    }
    if (!passesGroqThreshold(groq, env.GROQ_MIN_SCORE)) {
      out.push({
        listing,
        median: deal.median,
        isHotDeal: true,
        dealMarginPct: deal.dealMarginPct,
        action: "skipped_groq",
        claude,
        groq,
      });
      continue;
    }

    let listingId: number | null = null;
    let duplicateNotify = false;

    if (pool) {
      const client = await pool.connect();
      try {
        const prior = await findListingByUrl(client, listing.url);
        duplicateNotify = alreadyNotifiedForDeal(prior);
        const { id } = await upsertListing(client, listing);
        listingId = id;
        await insertPriceSnapshot(client, id, listing);
      } finally {
        client.release();
      }
    }

    if (opts.sendOwnerSms && duplicateNotify) {
      out.push({
        listing,
        median: deal.median,
        isHotDeal: true,
        dealMarginPct: deal.dealMarginPct,
        action: "skipped_duplicate_notify",
        claude,
        groq,
      });
      continue;
    }

    const canSms =
      opts.sendOwnerSms &&
      Boolean(env.TELNYX_API_KEY && env.TELNYX_FROM_NUMBER && env.NOTIFY_SMS_TO);

    if (opts.sendOwnerSms && !canSms) {
      out.push({
        listing,
        median: deal.median,
        isHotDeal: true,
        dealMarginPct: deal.dealMarginPct,
        action: "would_notify_no_sms_config",
        claude,
        groq,
      });
      continue;
    }

    if (canSms) {
      await notifyDealToOwner({
        listingUrl: listing.url,
        title: listing.title,
        priceCad: listing.priceCad,
        year: listing.year,
        isHotDeal: true,
        median: deal.median,
      });
      if (pool && listingId != null) {
        const client = await pool.connect();
        try {
          await markDealNotified(client, listingId);
        } finally {
          client.release();
        }
      }
      out.push({
        listing,
        median: deal.median,
        isHotDeal: true,
        dealMarginPct: deal.dealMarginPct,
        action: "notified",
        claude,
        groq,
      });
      continue;
    }

    out.push({
      listing,
      median: deal.median,
      isHotDeal: true,
      dealMarginPct: deal.dealMarginPct,
      action: pool ? "recorded_no_notify" : "hot_deal_no_database",
      claude,
      groq,
    });
  }

  return out;
}
