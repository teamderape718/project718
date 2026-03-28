import type { Context } from "telegraf";
import { Markup } from "telegraf";
import { loadEnv } from "../config/env.js";
import { notifyTelegramHtml } from "../services/telegram-notify.js";
import { pickDealCandidates } from "../deals/hot-candidates.js";
import { getPortalPool } from "../portal/db-access.js";
import * as repo from "../portal/repo.js";
import {
  enrichListingsWithDetails,
  scrapeKijijiQuebec,
} from "../scrapers/kijiji/kijiji-quebec.js";
import { getDeal, putDeal, shortDealId } from "./deal-cache.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function runTelegramScan(ctx: Context): Promise<void> {
  const env = loadEnv();
  await ctx.reply("Scan en cours… (peut prendre 1–3 min)");
  const listings = await scrapeKijijiQuebec({
    startUrl: env.KIJIJI_QUEBEC_AUTOS_URL,
    maxPages: env.TELEGRAM_SCAN_PAGES,
    headless: env.HEADLESS,
    applyPrivateFilter: true,
    fetchListingDetails: false,
  });

  const candidates = pickDealCandidates(listings, {
    minMarginPct: env.TELEGRAM_MIN_MARGIN_PCT,
    maxItems: env.TELEGRAM_DEALS_MAX,
  });

  if (candidates.length) {
    await enrichListingsWithDetails(
      candidates.map((c) => c.listing),
      env.HEADLESS
    );
  }

  const pool = getPortalPool();
  if (pool) {
    const c = await pool.connect();
    try {
      await repo.upsertKv(c, "last_telegram_scan", {
        at: new Date().toISOString(),
        count: candidates.length,
      });
    } finally {
      c.release();
    }
  }

  if (!candidates.length) {
    await ctx.reply(
      "Aucune annonce à fort potentiel sur cette passe (filtres + médiane). Réessaie plus tard."
    );
    return;
  }

  for (const c of candidates) {
    const id = shortDealId(c.listing.url);
    putDeal(id, {
      listing: c.listing,
      median: c.median,
      dealMarginPct: c.dealMarginPct,
      potentialLabel: c.potentialLabel,
    });

    const label =
      c.potentialLabel === "hot"
        ? "🔥 HOT (≥15% sous médiane)"
        : "⚡ Fort potentiel";
    const price =
      c.listing.priceCad != null ? `${c.listing.priceCad} $` : "prix N/D";
    const med = c.median != null ? `${c.median} $` : "N/D";
    const margin =
      c.dealMarginPct != null ? `${c.dealMarginPct.toFixed(1)}%` : "N/D";
    const phoneHint = c.listing.sellerPhoneE164
      ? "📱 Numéro détecté — envoi SMS possible."
      : "📱 Numéro non visible — contact via Kijiji.";

    const text =
      `${label}\n<b>${escapeHtml(c.listing.title)}</b>\n` +
      `💰 ${escapeHtml(price)} · médiane ${escapeHtml(med)} · 📉 ${escapeHtml(margin)} sous médiane\n` +
      `${phoneHint}\n` +
      `<a href="${escapeHtml(c.listing.url)}">Ouvrir l'annonce</a>`;

    await ctx.reply(text, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        Markup.button.callback("Commencer le deal", `deal:${id}`),
      ]),
    });

    if (c.potentialLabel === "hot") {
      const base = env.PUBLIC_SITE_URL?.replace(/\/$/, "");
      const inline_keyboard =
        base != null
          ? [[{ text: "🤝 Admin négociations", url: `${base}/admin/panel?tab=negotiations` }]]
          : undefined;
      await notifyTelegramHtml(
        `<b>Listing HOT</b>\n${escapeHtml(c.listing.title)}\n<a href="${escapeHtml(c.listing.url)}">Annonce</a>`,
        inline_keyboard ? { inline_keyboard } : undefined
      );
    }
  }
}

export async function readLastScanSummary(): Promise<string> {
  const pool = getPortalPool();
  if (!pool) return "Base non configurée (DATABASE_URL).";
  const c = await pool.connect();
  try {
    const v = await repo.getKv(c, "last_telegram_scan");
    if (!v || typeof v !== "object") return "Aucun scan enregistré.";
    const o = v as { at?: string; count?: number };
    return `Dernier scan : ${o.at ?? "?"} — ${o.count ?? 0} deal(s) retenu(s).`;
  } finally {
    c.release();
  }
}

export { escapeHtml };
