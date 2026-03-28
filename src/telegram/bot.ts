import { Telegraf, Markup } from "telegraf";
import { loadEnv } from "../config/env.js";
import { getDeal } from "./deal-cache.js";
import { logNegotiationFromDeal } from "./negotiation-log.js";
import { readLastScanSummary, runTelegramScan } from "./scan-runner.js";
import {
  buildSellerOutreachSms,
  smsSellerTemplate,
} from "../services/telnyx-sms.js";
import { escapeHtml } from "./scan-runner.js";

function parseAllowedChats(raw: string | undefined): Set<string> | null {
  if (!raw?.trim()) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function createTelegramBot() {
  const env = loadEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN est requis pour le bot.");
  }
  const allowed = parseAllowedChats(env.TELEGRAM_ALLOWED_CHAT_IDS);
  const bot = new Telegraf(token);

  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (allowed && chatId != null && !allowed.has(String(chatId))) {
      await ctx.reply("Accès refusé.");
      return;
    }
    return next();
  });

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "TEAM DERAPE — Deals Kijiji + contrôle.",
        "",
        "/menu — clavier (scan, statut, site)",
        "/scan — chercher des annonces à fort potentiel",
        "Bouton « Commencer le deal » → SMS vendeur (Telnyx) si numéro sur la fiche.",
      ].join("\n")
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("/menu — panneau · /scan — deals · /status — dernier scan");
  });

  bot.command("menu", async (ctx) => {
    await ctx.reply(
      "Panneau de contrôle :",
      Markup.keyboard([["🔍 Scan Kijiji"], ["📊 Statut dernier scan"]]).resize()
    );
    if (env.PUBLIC_SITE_URL) {
      await ctx.reply(
        "Liens (HTTPS requis par Telegram) :",
        Markup.inlineKeyboard([
          [Markup.button.url("🌐 Site", env.PUBLIC_SITE_URL)],
          [Markup.button.url("⚙️ Admin", `${env.PUBLIC_SITE_URL}/admin/panel`)],
        ])
      );
    }
  });

  bot.hears("🔍 Scan Kijiji", async (ctx) => {
    await runTelegramScan(ctx);
  });

  bot.hears("📊 Statut dernier scan", async (ctx) => {
    await ctx.reply(await readLastScanSummary());
  });

  bot.command("scan", async (ctx) => {
    await runTelegramScan(ctx);
  });

  bot.command("status", async (ctx) => {
    await ctx.reply(await readLastScanSummary());
  });

  bot.action(/^deal:(.+)$/, async (ctx) => {
    const id = ctx.match[1]!;
    const deal = getDeal(id);
    await ctx.answerCbQuery();

    if (!deal) {
      await ctx.reply("Cette offre a expiré. Lance /scan.");
      return;
    }

    const model = deal.listing.modelHint ?? deal.listing.title;
    const msg = buildSellerOutreachSms(model);
    const phone = deal.listing.sellerPhoneE164;

    if (!phone) {
      await logNegotiationFromDeal({
        listingUrl: deal.listing.url,
        title: deal.listing.title,
        sellerPhone: null,
        smsSent: false,
      });
      await ctx.reply(
        [
          "Pas de numéro sur la fiche — écris le vendeur depuis Kijiji.",
          "",
          "<b>Message suggéré :</b>",
          escapeHtml(msg),
        ].join("\n"),
        { parse_mode: "HTML" }
      );
      return;
    }

    try {
      await smsSellerTemplate(phone, model);
      await logNegotiationFromDeal({
        listingUrl: deal.listing.url,
        title: deal.listing.title,
        sellerPhone: phone,
        smsSent: true,
      });
      await ctx.reply(
        `✅ SMS envoyé au vendeur.\n\n<code>${escapeHtml(msg)}</code>`,
        { parse_mode: "HTML" }
      );
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await logNegotiationFromDeal({
        listingUrl: deal.listing.url,
        title: deal.listing.title,
        sellerPhone: phone,
        smsSent: false,
      });
      await ctx.reply(
        [
          `Échec Telnyx : ${escapeHtml(err)}`,
          "",
          "<b>Copie ce texte :</b>",
          escapeHtml(msg),
        ].join("\n"),
        { parse_mode: "HTML" }
      );
    }
  });

  return bot;
}

async function main() {
  const bot = createTelegramBot();
  await bot.launch();
  console.log("Bot Telegram actif (long polling, 24/7). Ctrl+C pour arrêter.");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

const isMain =
  process.argv[1]?.replace(/\\/g, "/").endsWith("telegram/bot.ts") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("telegram/bot.js");

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
