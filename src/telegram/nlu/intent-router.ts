import type { NegotiationStage, WhitelistedPlan } from "./types.js";
import { isNegotiationStage } from "./types.js";

const STAGE_ALIASES: Record<string, NegotiationStage> = {
  nouveau: "new",
  new: "new",
  neuf: "new",
  contact: "contacted",
  contacte: "contacted",
  contacté: "contacted",
  contacted: "contacted",
  negociation: "negotiating",
  négociation: "negotiating",
  nego: "negotiating",
  négo: "negotiating",
  negotiating: "negotiating",
  gagne: "won",
  gagné: "won",
  won: "won",
  perdu: "lost",
  lost: "lost",
};

function normalizeStageToken(tok: string): NegotiationStage | null {
  const k = tok.trim().toLowerCase();
  if (isNegotiationStage(k)) return k;
  return STAGE_ALIASES[k] ?? null;
}

/**
 * Regex-first intent detection (no network). Returns a plan or null to fall back to LLM / help.
 */
export function tryParseRegexPlan(text: string): WhitelistedPlan | null {
  const t = text.trim();
  if (!t) return null;

  // deal|nego 12 stage contacted  OR  deal 12 contacted
  const stageRe =
    /^(?:deal|nego|négo|négociation)\s*#?(\d+)\s+(?:(?:stage|étape|etape)\s+)?(\S+)$/i;
  const mStage = t.match(stageRe);
  if (mStage) {
    const id = Number(mStage[1]);
    const stage = normalizeStageToken(mStage[2] ?? "");
    if (Number.isFinite(id) && id > 0 && stage) {
      return { actions: [{ type: "set_stage", negotiation_id: id, stage }] };
    }
  }

  // note 5 texte...  OR  noter deal 5 ...
  const noteRe = /^(?:note|noter)\s+(?:deal|nego|négo|négociation\s*)?#?(\d+)\s+([\s\S]+)$/i;
  const mNote = t.match(noteRe);
  if (mNote) {
    const id = Number(mNote[1]);
    const body = (mNote[2] ?? "").trim();
    if (Number.isFinite(id) && id > 0 && body.length > 0) {
      return { actions: [{ type: "append_note", negotiation_id: id, text: body }] };
    }
  }

  // sms 3 contact  OR  envoyer sms 3 followup
  const smsRe =
    /^(?:sms|envoyer\s+sms)\s+(?:deal|nego|négo|négociation\s*)?#?(\d+)\s+(contact|followup|slots|confirm_rdv)\b(?:\s+([\s\S]+))?$/i;
  const mSms = t.match(smsRe);
  if (mSms) {
    const id = Number(mSms[1]);
    const template = (mSms[2] ?? "").toLowerCase() as
      | "contact"
      | "followup"
      | "slots"
      | "confirm_rdv";
    const rest = (mSms[3] ?? "").trim();
    if (!Number.isFinite(id) || id <= 0) return null;
    if (template === "slots" && rest) {
      return {
        actions: [
          {
            type: "send_sms",
            negotiation_id: id,
            template,
            slots_text: rest,
          },
        ],
      };
    }
    if (template === "confirm_rdv" && rest) {
      return {
        actions: [
          {
            type: "send_sms",
            negotiation_id: id,
            template,
            when_where: rest,
          },
        ],
      };
    }
    return {
      actions: [{ type: "send_sms", negotiation_id: id, template }],
    };
  }

  return null;
}
