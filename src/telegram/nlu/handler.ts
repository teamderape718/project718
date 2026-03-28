import type { Context } from "telegraf";
import { getPortalPool } from "../../portal/db-access.js";
import { executeWhitelistedPlan } from "./executor.js";
import { tryParseRegexPlan } from "./intent-router.js";
import { isTelegramNluLlmEnabled, tryParseWithOpenAI } from "./llm-parser.js";

function actorFromCtx(ctx: Context): string {
  const id = ctx.chat?.id ?? ctx.from?.id;
  return id != null ? `telegram:${id}` : "telegram:unknown";
}

const HELP_TEXT = [
  "<b>Messages libres (raccourcis)</b>",
  "• <code>deal 12 contacted</code> — étape (new, contacted, negotiating, won, lost)",
  "• <code>note 12 …</code> — ajouter une note",
  "• <code>sms 12 contact</code> / <code>sms 12 followup</code> — SMS modèle",
  "• <code>sms 12 slots Lun 10h, Mar 15h</code> — créneaux (texte obligatoire)",
  "• <code>sms 12 confirm_rdv demain 14h, adresse</code> — confirmation RDV (détail obligatoire)",
  "",
  "Avec <code>OPENAI_API_KEY</code>, le bot interprète aussi le langage naturel (actions limitées : étape, note, SMS par id deal). Désactiver LLM : <code>TELEGRAM_NLU_LLM=0</code>.",
].join("\n");

export async function handleTelegramNluText(ctx: Context, text: string): Promise<void> {
  const pool = getPortalPool();
  if (!pool) {
    await ctx.reply("Base de données non configurée (DATABASE_URL).");
    return;
  }

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === "aide nlu" ||
    lower === "help nlu" ||
    lower === "commandes nlu" ||
    lower === "? nlu"
  ) {
    await ctx.reply(HELP_TEXT, { parse_mode: "HTML" });
    return;
  }

  let plan = tryParseRegexPlan(trimmed);
  let source: "regex" | "llm" = "regex";

  if (!plan && isTelegramNluLlmEnabled()) {
    try {
      plan = await tryParseWithOpenAI(trimmed);
      source = "llm";
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.reply(`Interprétation LLM indisponible : ${msg.slice(0, 400)}`);
      return;
    }
  }

  if (!plan || plan.actions.length === 0) {
    if (plan?.reply_hint?.trim()) {
      await ctx.reply(plan.reply_hint.trim());
      return;
    }
    await ctx.reply(
      [
        "Je n’ai pas reconnu d’action. Exemples :",
        "• deal 5 negotiating",
        "• note 5 Rappeler demain 10h",
        "• sms 5 followup",
        "• sms 5 slots Mar 10h, jeu. 15h",
        "",
        "Tape <code>aide nlu</code> pour la liste.",
      ].join("\n"),
      { parse_mode: "HTML" }
    );
    return;
  }

  const client = await pool.connect();
  try {
    const actor = actorFromCtx(ctx);
    const { lines, ok } = await executeWhitelistedPlan(client, plan, { actor, source });
    const parts = [...lines];
    if (plan.reply_hint?.trim() && source === "llm") {
      parts.push("", plan.reply_hint.trim());
    }
    await ctx.reply(parts.join("\n"));
  } finally {
    client.release();
  }
}
