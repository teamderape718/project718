import { loadEnv } from "../src/config/env.js";
import { scrapeKijijiQuebec } from "../src/scrapers/kijiji/kijiji-quebec.js";
import { runMandatoryFiveFilters } from "../src/filters/mandatory-five.js";
import { scoreListingDeal } from "../src/scoring/deal-score.js";

async function main() {
  const env = loadEnv();
  const maxPages = Number(process.argv[2]) || 3;
  const listings = await scrapeKijijiQuebec({
    startUrl: env.KIJIJI_QUEBEC_AUTOS_URL,
    maxPages,
    headless: env.HEADLESS,
    applyPrivateFilter: true,
  });

  const enriched = listings.map((l) => {
    const filter = runMandatoryFiveFilters(l);
    const score = scoreListingDeal(l);
    return {
      ...l,
      passesMandatoryFive: filter.ok,
      filterReason: filter.ok ? undefined : filter.reason,
      ...score,
    };
  });

  console.log(JSON.stringify({ count: enriched.length, listings: enriched }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
