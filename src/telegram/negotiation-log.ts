import { getPortalPool } from "../portal/db-access.js";
import * as repo from "../portal/repo.js";

export async function logNegotiationFromDeal(params: {
  listingUrl: string;
  title: string;
  sellerPhone: string | null;
  smsSent: boolean;
  outboundSms?: {
    body: string;
    providerId?: string | null;
    templateKey?: string;
  };
}): Promise<number | null> {
  const pool = getPortalPool();
  if (!pool) return null;
  const c = await pool.connect();
  try {
    const id = await repo.insertNegotiation(c, {
      listing_url: params.listingUrl,
      title: params.title,
      seller_phone: params.sellerPhone,
      stage: params.smsSent ? "contacted" : "new",
      notes: params.smsSent
        ? "SMS Telnyx envoyé depuis Telegram (Commencer le deal)"
        : "Numéro absent — message suggéré au propriétaire",
    });
    if (params.smsSent && params.outboundSms && params.sellerPhone) {
      await repo.insertNegotiationMessage(c, {
        negotiation_id: id,
        direction: "out",
        body: params.outboundSms.body,
        provider_id: params.outboundSms.providerId ?? null,
        template_key: params.outboundSms.templateKey ?? "contact",
      });
    }
    return id;
  } finally {
    c.release();
  }
}
