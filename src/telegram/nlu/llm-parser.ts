import { loadEnv } from "../../config/env.js";
import { parseWhitelistedPlanJson, type WhitelistedPlan } from "./types.js";

const SYSTEM = `Tu es un routeur d'intentions pour un bot CRM automobile (négociations Kijiji).
Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown), forme exacte:
{"actions":[...],"reply_hint":"optionnel, court, en français"}

Chaque élément de "actions" est UN de ces types (clé "type" obligatoire):
1) {"type":"set_stage","negotiation_id":<entier>,"stage":"new"|"contacted"|"negotiating"|"won"|"lost"}
2) {"type":"append_note","negotiation_id":<entier>,"text":"<note>"}
3) {"type":"send_sms","negotiation_id":<entier>,"template":"contact"|"followup"|"slots"|"confirm_rdv","model_label":"optionnel","slots_text":"OBLIGATOIRE si template=slots (ex. Lun 10h, Mar 15h)","when_where":"OBLIGATOIRE si template=confirm_rdv (date/heure/lieu)"}

Règles strictes:
- N'invente JAMAIS un negotiation_id : s'il n'est pas clairement mentionné par l'utilisateur, mets "actions":[] et explique dans reply_hint.
- Pas d'autres types d'actions. Pas de numéro de téléphone libre : l'envoi SMS utilise uniquement le vendeur déjà en base pour ce deal.
- Si la demande est ambiguë ou hors périmètre, "actions":[] et reply_hint utile.
- Maximum 5 actions.`;

function truthyEnv(v: string | undefined): boolean {
  if (v == null || v === "") return false;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export function isTelegramNluLlmEnabled(): boolean {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY?.trim()) return false;
  const flag = env.TELEGRAM_NLU_LLM;
  if (flag !== undefined && flag !== "") {
    return truthyEnv(flag);
  }
  return true;
}

export async function tryParseWithOpenAI(userText: string): Promise<WhitelistedPlan | null> {
  const env = loadEnv();
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userText.trim() },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI NLU HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  return parseWhitelistedPlanJson(parsed);
}
