import { loadEnv } from "./config/env.js";
import { runKijijiCycle } from "./pipeline/kijiji-cycle.js";
import { scrapeKijijiQuebec } from "./scrapers/kijiji/kijiji-quebec.js";

const cmd = process.argv[2];

async function scrapeKijijiCli() {
  const env = loadEnv();
  const maxPages = Number(process.argv[3]) || 3;
  const listings = await scrapeKijijiQuebec({
    startUrl: env.KIJIJI_QUEBEC_AUTOS_URL,
    maxPages,
    headless: env.HEADLESS,
    applyPrivateFilter: true,
  });
  console.log(JSON.stringify({ count: listings.length, listings }, null, 2));
}

async function pipelineKijijiCli() {
  const args = process.argv.slice(3);
  const sendOwnerSms = args.includes("--notify");
  const fetchListingDetails = args.includes("--details");
  const numArg = args.find((a) => /^\d+$/.test(a));
  const maxPages = numArg ? Number(numArg) : 2;
  const results = await runKijijiCycle({
    maxPages,
    applyPrivateFilter: true,
    fetchListingDetails,
    sendOwnerSms,
  });
  console.log(JSON.stringify({ count: results.length, results }, null, 2));
}

async function main() {
  if (cmd === "scrape-kijiji") {
    await scrapeKijijiCli();
    return;
  }
  if (cmd === "pipeline-kijiji") {
    await pipelineKijijiCli();
    return;
  }
  console.error(
    "Usage:\n  tsx src/index.ts scrape-kijiji [maxPages]\n  tsx src/index.ts pipeline-kijiji [maxPages] [--notify] [--details]"
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
