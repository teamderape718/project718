import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { loadEnv } from "./config/env.js";
import { getPortalPool } from "./portal/db-access.js";
import { runKijijiCycle } from "./pipeline/kijiji-cycle.js";
import { registerPortalRoutes } from "./routes/portal-routes.js";
import { scrapeKijijiQuebec } from "./scrapers/kijiji/kijiji-quebec.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDist = join(__dirname, "../web/dist");

const env = loadEnv();

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  await registerPortalRoutes(app);

  app.get("/health", async () => ({ ok: true }));

  app.get("/api/health", async () => ({ ok: true }));

  /** Diagnostic déploiement : site + base de données */
  app.get("/health/ready", async (_request, reply) => {
    const webBuilt = existsSync(join(webDist, "index.html"));
    const pool = getPortalPool();
    let database = false;
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        database = true;
      } catch {
        database = false;
      } finally {
        client.release();
      }
    }
    const body = { ok: webBuilt && database, webBuilt, database, databaseConfigured: Boolean(pool) };
    if (!body.ok) return reply.status(503).send(body);
    return body;
  });

  app.post<{
    Body: {
      maxPages?: number;
      applyPrivateFilter?: boolean;
      fetchListingDetails?: boolean;
      sendOwnerSms?: boolean;
    };
  }>("/pipeline/kijiji", async (request, reply) => {
    const maxPages = request.body?.maxPages ?? 2;
    const applyPrivateFilter = request.body?.applyPrivateFilter ?? true;
    const fetchListingDetails = request.body?.fetchListingDetails ?? false;
    const sendOwnerSms = request.body?.sendOwnerSms ?? false;
    try {
      const results = await runKijijiCycle({
        maxPages,
        applyPrivateFilter,
        fetchListingDetails,
        sendOwnerSms,
      });
      return {
        count: results.length,
        results: results.map((r) => ({
          action: r.action,
          url: r.listing.url,
          title: r.listing.title,
          priceCad: r.listing.priceCad,
          median: r.median,
          isHotDeal: r.isHotDeal,
          dealMarginPct: r.dealMarginPct,
          claude: r.claude,
          groq: r.groq,
        })),
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : "Pipeline failed",
      });
    }
  });

  app.post<{
    Body: { maxPages?: number; applyPrivateFilter?: boolean };
  }>("/scrape/kijiji", async (request, reply) => {
    const maxPages = request.body?.maxPages ?? 2;
    const applyPrivateFilter = request.body?.applyPrivateFilter ?? true;
    try {
      const listings = await scrapeKijijiQuebec({
        startUrl: env.KIJIJI_QUEBEC_AUTOS_URL,
        maxPages,
        headless: env.HEADLESS,
        applyPrivateFilter,
      });
      return { count: listings.length, listings };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : "Scrape failed",
      });
    }
  });

  if (existsSync(join(webDist, "index.html"))) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: "/",
    });

    app.setNotFoundHandler((request, reply) => {
      const pathOnly = request.url.split("?")[0] ?? "";
      if (
        request.method === "GET" &&
        !pathOnly.startsWith("/api") &&
        !pathOnly.startsWith("/pipeline") &&
        !pathOnly.startsWith("/scrape") &&
        pathOnly !== "/health"
      ) {
        return reply.sendFile("index.html");
      }
      return reply.status(404).send({ error: "Not Found" });
    });
  } else {
    app.get("/", async () => ({
      name: "Q-CFA API",
      hint: "Lancez npm run web:build pour servir le site, ou utilisez /api/*",
      health: "/health",
      apiHealth: "/api/health",
    }));
  }

  return app;
}

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

const isMain =
  process.argv[1]?.replace(/\\/g, "/").endsWith("server.ts") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("server.js");

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
