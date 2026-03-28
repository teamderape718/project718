import type { Context } from "telegraf";
import { Telegraf, Markup } from "telegraf";
import { loadEnv } from "../config/env.js";
import { getPortalPool } from "../portal/db-access.js";
import { getDeal } from "./deal-cache.js";
import { logNegotiationFromDeal } from "./negotiation-log.js";
import {
  appendOutboundSmsLog,
  fetchNegotiation,
  fetchRecentNegotiations,
  isNegoStage,
  NEGO_STAGES,
  setNegotiationStage,
} from "./negotiations-telegram.js";
import { readLastScanSummary, runTelegramScan } from "./scan-runner.js";
import { buildSellerOutreachSms, smsSellerTemplate, smsWithTemplate } from "../services/telnyx-sms.js";
import { buildSmsFromTemplate, type SmsTemplateKey } from "../services/sms-templates.js";
import { normalizeToE164 } from "../utils/phone.js";
import { escapeHtml } from "./scan-runner.js";
import { handleTelegramNluText } from "./nlu/handler.js";

const STAGE_LABEL: Record<string, string> = {
  new: "nouveau",
  contacted: "contacté",
  negotiating: "négociation",
  won: "gagné",
  lost: "perdu",
};

const SMS_TEMPLATE_LABEL: Record<SmsTemplateKey, string> = {
  contact: "1ère prise de contact",
  followup: "Relance",
  slots: "Créneaux",
  confirm_rdv: "Conf. RDV",
};

function adminPanelUrl(env: ReturnType<typeof loadEnv>, tab?: string): string | null {
  const base = env.PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return tab ? `${base}/admin/panel?tab=${tab}` : `${base}/admin/panel`;
}

function negotiationDetailKeyboard(
  id: number,
  currentStage: string,
  hasPhone: boolean,
  env: ReturnType<typeof loadEnv>
) {
  const stageRow1 = NEGO_STAGES.slice(0, 3).map((st) =>
    Markup.button.callback(
      currentStage === st ? `✓ ${STAGE_LABEL[st] ?? st}` : STAGE_LABEL[st] ?? st,
      `st:${id}:${st}`
    )
  );
  const stageRow2 = NEGO_STAGES.slice(3).map((st) =>
    Markup.button.callback(
      currentStage === st ? `✓ ${STAGE_LABEL[st] ?? st}` : STAGE_LABEL[st] ?? st,
      `st:${id}:${st}`
    )
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [stageRow1, stageRow2];
  if (hasPhone) {
    const smsBtns = (
      ["contact", "followup", "slots", "confirm_rdv"] as const
    ).map((key) =>
      Markup.button.callback(SMS_TEMPLATE_LABEL[key], `sp:${id}:${key}`)
    );
    rows.push([smsBtns[0]!, smsBtns[1]!], [smsBtns[2]!, smsBtns[3]!]);
  }
  const admin = adminPanelUrl(env, "negotiations");
  if (admin) {
    rows.push([Markup.button.url("⚙️ Admin négociations", admin)]);
  }
  return Markup.inlineKeyboard(rows);
}

async function replyNegotiationDetail(
  ctx: {
    reply: (
      text: string,
      extra?: { parse_mode: "HTML" } & Record<string, unknown>
    ) => Promise<unknown>;
  },
  row: import("../portal/repo.js").NegotiationRow,
  env: ReturnType<typeof loadEnv>
): Promise<void> {
  const phone = row.seller_phone
    ? `<code>${escapeHtml(row.seller_phone)}</code>`
    : "<i>aucun numéro</i>";
  const link = row.listing_url
    ? `\n<a href="${escapeHtml(row.listing_url)}">Annonce</a>`
    : "";
  const notes =
    row.notes?.trim() && row.notes.length < 800
      ? `\n\n<i>${escapeHtml(row.notes.trim())}</i>`
      : row.notes?.trim()
        ? `\n\n<i>${escapeHtml(row.notes.trim().slice(0, 400))}…</i>`
        : "";
  const text =
    `<b>Deal #${row.id}</b> · ${escapeHtml(STAGE_LABEL[row.stage] ?? row.stage)}\n` +
    `${escapeHtml(row.title ?? "(sans titre)")}\n` +
    `📱 ${phone}${link}${notes}`;
  await ctx.reply(text, {
    parse_mode: "HTML",
    ...negotiationDetailKeyboard(
      row.id,
      row.stage,
      Boolean(row.seller_phone),
      env
    ),
  });
}

async function sendDealsList(ctx: Context, _env: ReturnType<typeof loadEnv>): Promise<void> {
  if (!getPortalPool()) {
    await ctx.reply("Base non configurée (DATABASE_URL).");
    return;
  }
  const rows = await fetchRecentNegotiations(20);
  if (!rows.length) {
    await ctx.reply("Aucune négociation en base.");
    return;
  }
  const buttons = rows.map((row) => {
    const short = (row.title ?? "").slice(0, 24);
    const label =
      `#${row.id} · ${STAGE_LABEL[row.stage] ?? row.stage}${short ? ` — ${short}` : ""}`.slice(
        0,
        64
      );
    return Markup.button.callback(label, `neo:${row.id}`);
  });
  const pairs: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    pairs.push(buttons.slice(i, i + 2));
  }
  await ctx.reply("Négociations récentes — touche une ligne pour le détail :", {
    ...Markup.inlineKeyboard(pairs),
  });
}

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
    const payload = ctx.startPayload?.trim();
    const deep = payload?.match(/^nego_(\d+)$/);
    if (deep) {
      const id = parseInt(deep[1]!, 10);
      if (Number.isFinite(id) && id >= 1) {
        const row = await fetchNegotiation(id);
        if (row) {
          await replyNegotiationDetail(ctx, row, env);
          return;
        }
        await ctx.reply("Négociation introuvable.");
        return;
      }
    }
    await ctx.reply(
      [
        "TEAM DERAPE — Deals Kijiji + contrôle.",
        "",
        "/menu — clavier (scan, deals, statut, liens)",
        "/scan — annonces à fort potentiel",
        "/deals — négociations récentes",
        "/negotiation &lt;id&gt; — détail, étapes, SMS modèles",
        "/orders — lien admin commandes Stripe",
        "Bouton « Commencer le deal » → SMS vendeur (Telnyx) si numéro sur la fiche.",
        "Texte libre : ex. <code>deal 3 negotiating</code>, <code>note 3 …</code>, <code>sms 3 contact</code> — <code>aide nlu</code>.",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "/menu — panneau",
        "/scan — deals Kijiji",
        "/deals — liste négociations",
        "/negotiation &lt;id&gt; — détail + étapes + SMS",
        "/orders — commandes Stripe (admin)",
        "/status — dernier scan",
        "",
        "NLU : <code>aide nlu</code> — raccourcis + langage naturel (OpenAI optionnel).",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
  });

  bot.command("menu", async (ctx) => {
    await ctx.reply(
      "Panneau de contrôle :",
      Markup.keyboard([
        ["🔍 Scan Kijiji", "📋 Mes deals"],
        ["📊 Statut dernier scan"],
      ]).resize()
    );
    if (env.PUBLIC_SITE_URL) {
      const base = env.PUBLIC_SITE_URL.replace(/\/$/, "");
      await ctx.reply(
        "Liens (HTTPS requis par Telegram) :",
        Markup.inlineKeyboard([
          [Markup.button.url("🌐 Site", env.PUBLIC_SITE_URL)],
          [
            Markup.button.url("⚙️ Admin", `${base}/admin/panel`),
            Markup.button.url("🤝 Négociations", `${base}/admin/panel?tab=negotiations`),
          ],
          [Markup.button.url("🛒 Commandes", `${base}/admin/panel?tab=orders`)],
        ])
      );
    }
  });

  bot.hears("🔍 Scan Kijiji", async (ctx) => {
    await runTelegramScan(ctx);
  });

  bot.hears("📋 Mes deals", async (ctx) => {
    await sendDealsList(ctx, env);
  });

  bot.hears("📊 Statut dernier scan", async (ctx) => {
    await ctx.reply(await readLastScanSummary());
  });

  bot.command("deals", async (ctx) => {
    await sendDealsList(ctx, env);
  });

  bot.command(["negotiation", "nego"], async (ctx) => {
    const raw = ctx.args[0];
    if (!raw) {
      await ctx.reply(
        "Indique l’id : <code>/negotiation 42</code>\nListe : <code>/deals</code>",
        { parse_mode: "HTML" }
      );
      return;
    }
    const id = parseInt(raw, 10);
    if (!Number.isFinite(id) || id < 1) {
      await ctx.reply("Id invalide.");
      return;
    }
    const row = await fetchNegotiation(id);
    if (!row) {
      await ctx.reply("Négociation introuvable (base ou id).");
      return;
    }
    await replyNegotiationDetail(ctx, row, env);
  });

  bot.command("scan", async (ctx) => {
    await runTelegramScan(ctx);
  });

  bot.command("status", async (ctx) => {
    await ctx.reply(await readLastScanSummary());
  });

  bot.command("orders", async (ctx) => {
    const u = adminPanelUrl(env, "orders");
    if (!u) {
      await ctx.reply("PUBLIC_SITE_URL non configuré — impossible d’ouvrir l’admin.");
      return;
    }
    await ctx.reply("Commandes Stripe :", Markup.inlineKeyboard([[Markup.button.url("🛒 Ouvrir l’admin (commandes)", u)]]));
  });

  bot.action(/^neo:(\d+)$/, async (ctx) => {
    const id = parseInt(ctx.match[1]!, 10);
    await ctx.answerCbQuery();
    const row = await fetchNegotiation(id);
    if (!row) {
      await ctx.reply("Négociation introuvable.");
      return;
    }
    await replyNegotiationDetail(ctx, row, env);
  });

  bot.action(/^st:(\d+):(\w+)$/, async (ctx) => {
    const id = parseInt(ctx.match[1]!, 10);
    const stage = ctx.match[2]!;
    await ctx.answerCbQuery();
    if (!isNegoStage(stage)) {
      await ctx.reply("Étape inconnue.");
      return;
    }
    const ok = await setNegotiationStage(id, stage);
    if (!ok) {
      await ctx.reply("Impossible de mettre à jour.");
      return;
    }
    const row = await fetchNegotiation(id);
    if (row) await replyNegotiationDetail(ctx, row, env);
  });

  bot.action(/^sp:(\d+):(contact|followup|slots|confirm_rdv)$/, async (ctx) => {
    const id = parseInt(ctx.match[1]!, 10);
    const key = ctx.match[2]! as SmsTemplateKey;
    await ctx.answerCbQuery();
    const row = await fetchNegotiation(id);
    if (!row) {
      await ctx.reply("Deal introuvable.");
      return;
    }
    if (!row.seller_phone) {
      await ctx.reply("Pas de numéro — complète la fiche dans l’admin ou contacte via Kijiji.");
      return;
    }
    if (key === "slots" || key === "confirm_rdv") {
      const hint =
        key === "slots"
          ? `Envoie par exemple :\n<code>sms ${id} slots Lun 10h, Mar 15h</code>`
          : `Envoie par exemple :\n<code>sms ${id} confirm_rdv demain 14h, 123 rue Example</code>`;
      await ctx.reply(
        [
          `<b>${escapeHtml(SMS_TEMPLATE_LABEL[key])}</b>`,
          "",
          "Ce modèle exige que tu précises les créneaux ou le détail du RDV dans le message (pas d’envoi en un clic).",
          "",
          hint,
          "",
          "Tu peux aussi utiliser l’admin (timeline du deal) pour remplir les champs.",
        ].join("\n"),
        { parse_mode: "HTML" }
      );
      return;
    }
    const model = (row.title ?? "véhicule").slice(0, 80);
    const text = buildSmsFromTemplate(key, { modelLabel: model });
    await ctx.reply(
      [
        `<b>Aperçu SMS</b> — ${escapeHtml(SMS_TEMPLATE_LABEL[key])}\nVers <code>${escapeHtml(row.seller_phone)}</code>\n\n<code>${escapeHtml(text)}</code>`,
        "",
        "Confirmer l’envoi ?",
      ].join("\n"),
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Envoyer", `sd:${id}:${key}`),
            Markup.button.callback("❌ Annuler", "sms_cancel"),
          ],
        ]),
      }
    );
  });

  bot.action(/^sd:(\d+):(contact|followup)$/, async (ctx) => {
    const id = parseInt(ctx.match[1]!, 10);
    const key = ctx.match[2]! as SmsTemplateKey;
    await ctx.answerCbQuery();
    const row = await fetchNegotiation(id);
    const phone = normalizeToE164(row?.seller_phone ?? "");
    if (!row || !phone) {
      await ctx.reply("Envoi impossible (numéro manquant ou invalide).");
      return;
    }
    const model = (row.title ?? "véhicule").slice(0, 80);
    const text = buildSmsFromTemplate(key, { modelLabel: model });
    try {
      const res = await smsWithTemplate({
        toE164: phone,
        template: key,
        modelLabel: model,
      });
      const providerId = res.data?.id ?? null;
      await appendOutboundSmsLog({
        negotiationId: id,
        body: text,
        templateKey: key,
        providerId,
      });
      await ctx.reply(`✅ SMS envoyé.\n\n<code>${escapeHtml(text)}</code>`, {
        parse_mode: "HTML",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.reply(`Échec envoi : ${escapeHtml(msg)}`, { parse_mode: "HTML" });
    }
  });

  bot.action("sms_cancel", async (ctx) => {
    await ctx.answerCbQuery("Annulé");
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
      const res = await smsSellerTemplate(phone, model);
      await logNegotiationFromDeal({
        listingUrl: deal.listing.url,
        title: deal.listing.title,
        sellerPhone: phone,
        smsSent: true,
        outboundSms: {
          body: msg,
          providerId: res.data?.id ?? null,
          templateKey: "contact",
        },
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

  bot.on("text", async (ctx, next) => {
    const text = ctx.message.text ?? "";
    if (text.startsWith("/")) return next();
    await handleTelegramNluText(ctx, text);
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
