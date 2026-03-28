import { loadEnv } from "../config/env.js";
import {
  buildSmsFromTemplate,
  validateSmsBodyLength,
  validateSmsTemplatePayload,
  type SmsTemplateKey,
} from "./sms-templates.js";
import { normalizeToE164 } from "../utils/phone.js";

const TELNYX_MESSAGES_URL = "https://api.telnyx.com/v2/messages";

export type SendSmsInput = {
  to: string;
  text: string;
  from?: string;
};

export type TelnyxMessageResponse = {
  data?: { id?: string };
  errors?: Array<{ detail?: string }>;
};

/**
 * Send SMS via Telnyx Messaging API.
 * @see https://developers.telnyx.com/api/messaging/create-message
 */
export async function sendSms(input: SendSmsInput): Promise<TelnyxMessageResponse> {
  const env = loadEnv();
  const apiKey = env.TELNYX_API_KEY;
  const from = input.from ?? env.TELNYX_FROM_NUMBER;
  if (!apiKey) throw new Error("TELNYX_API_KEY is not set");
  if (!from) throw new Error("TELNYX_FROM_NUMBER or from override is required");

  const body: Record<string, string> = {
    from,
    to: input.to,
    text: input.text,
  };
  if (env.TELNYX_MESSAGING_PROFILE_ID) {
    body.messaging_profile_id = env.TELNYX_MESSAGING_PROFILE_ID;
  }

  const res = await fetch(TELNYX_MESSAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as TelnyxMessageResponse;
  if (!res.ok) {
    const detail =
      json.errors?.map((e) => e.detail).filter(Boolean).join("; ") ||
      (await res.text().catch(() => res.statusText));
    throw new Error(`Telnyx SMS failed (${res.status}): ${detail}`);
  }
  return json;
}

export function buildDealAlertSms(params: {
  listingUrl: string;
  title: string;
  priceCad: number | null;
  year: number | null;
  isHotDeal: boolean;
  median: number | null;
}): string {
  const price = params.priceCad != null ? `${params.priceCad} CAD` : "prix N/D";
  const year = params.year != null ? String(params.year) : "année N/D";
  const deal = params.isHotDeal ? " HOT DEAL" : "";
  const med =
    params.median != null ? ` | médiane ref: ${params.median}$` : "";
  return `[Q-CFA${deal}] ${params.title} (${year}) — ${price}${med}\n${params.listingUrl}`;
}

export function buildSellerOutreachSms(modelLabel: string): string {
  return buildSmsFromTemplate("contact", { modelLabel });
}

export async function smsWithTemplate(params: {
  toE164: string;
  template: SmsTemplateKey;
  modelLabel?: string;
  slotsText?: string;
  whenWhere?: string;
}): Promise<TelnyxMessageResponse> {
  const pre = validateSmsTemplatePayload(params.template, {
    slotsText: params.slotsText,
    whenWhere: params.whenWhere,
  });
  if (!pre.ok) throw new Error(pre.error);
  const text = buildSmsFromTemplate(params.template, {
    modelLabel: params.modelLabel,
    slotsText: params.slotsText,
    whenWhere: params.whenWhere,
  });
  const len = validateSmsBodyLength(text);
  if (!len.ok) throw new Error(len.error);
  return sendSms({ to: params.toE164, text });
}

export async function notifyDealToOwner(params: {
  listingUrl: string;
  title: string;
  priceCad: number | null;
  year: number | null;
  isHotDeal: boolean;
  median: number | null;
}): Promise<TelnyxMessageResponse> {
  const env = loadEnv();
  const to = env.NOTIFY_SMS_TO;
  if (!to) throw new Error("NOTIFY_SMS_TO is not set");
  const text = buildDealAlertSms(params);
  return sendSms({ to, text });
}

export async function smsSellerTemplate(
  sellerPhoneE164: string,
  modelLabel: string
): Promise<TelnyxMessageResponse> {
  const to = normalizeToE164(sellerPhoneE164);
  if (!to) throw new Error("Numéro vendeur invalide pour SMS");
  const text = buildSellerOutreachSms(modelLabel);
  const len = validateSmsBodyLength(text);
  if (!len.ok) throw new Error(len.error);
  return sendSms({ to, text });
}
