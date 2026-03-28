import { getPortalPool } from "../portal/db-access.js";
import * as repo from "../portal/repo.js";

export async function logNegotiationFromDeal(params: {
  listingUrl: string;
  title: string;
  sellerPhone: string | null;
  smsSent: boolean;
}): Promise<void> {
  const pool = getPortalPool();
  if (!pool) return;
  const c = await pool.connect();
  try {
    await repo.insertNegotiation(c, {
      listing_url: params.listingUrl,
      title: params.title,
      seller_phone: params.sellerPhone,
      stage: params.smsSent ? "contacted" : "new",
      notes: params.smsSent
        ? "SMS Telnyx envoyé depuis Telegram (Commencer le deal)"
        : "Numéro absent — message suggéré au propriétaire",
    });
  } finally {
    c.release();
  }
}
