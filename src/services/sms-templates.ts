export type SmsTemplateKey =
  | "contact"
  | "followup"
  | "slots"
  | "confirm_rdv";

/** Long model names are truncated so SMS stay readable and within segment limits. */
export const MAX_SMS_MODEL_LABEL_LEN = 80;

/** Telnyx / carriers: keep a hard cap to avoid runaway costs and API errors. */
export const MAX_SMS_BODY_LENGTH = 1024;

const MIN_SLOTS_TEXT_LEN = 3;
const MIN_WHEN_WHERE_LEN = 6;

export type SmsTemplateValidateParams = {
  slotsText?: string;
  whenWhere?: string;
};

export function validateSmsTemplatePayload(
  key: SmsTemplateKey,
  params: SmsTemplateValidateParams
): { ok: true } | { ok: false; error: string } {
  const slots = (params.slotsText ?? "").trim();
  const when = (params.whenWhere ?? "").trim();
  switch (key) {
    case "contact":
    case "followup":
      return { ok: true };
    case "slots":
      if (slots.length < MIN_SLOTS_TEXT_LEN) {
        return {
          ok: false,
          error:
            "Pour le modèle « créneaux », précise au moins une proposition (ex. Lun 10h, Mar 15h).",
        };
      }
      return { ok: true };
    case "confirm_rdv":
      if (when.length < MIN_WHEN_WHERE_LEN) {
        return {
          ok: false,
          error:
            "Pour la confirmation de RDV, indique date/heure et lieu (ex. demain 14h, chez vous).",
        };
      }
      return { ok: true };
    default:
      return { ok: true };
  }
}

export function validateSmsBodyLength(body: string): { ok: true } | { ok: false; error: string } {
  if (body.length > MAX_SMS_BODY_LENGTH) {
    return {
      ok: false,
      error: `Message trop long (${body.length} caractères, max ${MAX_SMS_BODY_LENGTH}).`,
    };
  }
  return { ok: true };
}

function truncateModel(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "véhicule";
  return t.length > MAX_SMS_MODEL_LABEL_LEN ? t.slice(0, MAX_SMS_MODEL_LABEL_LEN) : t;
}

export function buildSmsFromTemplate(
  key: SmsTemplateKey,
  params: {
    modelLabel?: string;
    slotsText?: string;
    whenWhere?: string;
  }
): string {
  const model = truncateModel(params.modelLabel);
  switch (key) {
    case "contact":
      return `Bonjour, votre ${model} est-il toujours disponible ? Je suis acheteur sérieux. Merci.`;
    case "followup":
      return `Bonjour, je reprends contact pour votre ${model}. Seriez-vous ouvert à une offre raisonnable cette semaine ?`;
    case "slots": {
      const s = (params.slotsText ?? "").trim();
      return s
        ? `Bonjour, pour votre ${model}, voici des créneaux qui me conviennent : ${s}. Lequel vous convient ?`
        : `Bonjour, concernant votre ${model}, quels créneaux vous conviennent pour voir le véhicule ?`;
    }
    case "confirm_rdv": {
      const w = (params.whenWhere ?? "").trim();
      return w
        ? `C'est noté — RDV confirmé : ${w}. Merci.`
        : `C'est noté — je confirme notre rendez-vous. Merci.`;
    }
    default:
      return buildSmsFromTemplate("contact", params);
  }
}

export function isSmsTemplateKey(s: string): s is SmsTemplateKey {
  return s === "contact" || s === "followup" || s === "slots" || s === "confirm_rdv";
}
