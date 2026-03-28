import { getPortalPool } from "../portal/db-access.js";
import * as repo from "../portal/repo.js";
import type { NegotiationRow } from "../portal/repo.js";

export const NEGO_STAGES = ["new", "contacted", "negotiating", "won", "lost"] as const;
export type NegoStage = (typeof NEGO_STAGES)[number];

export function isNegoStage(s: string): s is NegoStage {
  return (NEGO_STAGES as readonly string[]).includes(s);
}

export async function fetchRecentNegotiations(limit: number): Promise<NegotiationRow[]> {
  const pool = getPortalPool();
  if (!pool) return [];
  const c = await pool.connect();
  try {
    return await repo.listRecentNegotiations(c, limit);
  } finally {
    c.release();
  }
}

export async function fetchNegotiation(id: number): Promise<NegotiationRow | null> {
  const pool = getPortalPool();
  if (!pool) return null;
  const c = await pool.connect();
  try {
    return await repo.getNegotiation(c, id);
  } finally {
    c.release();
  }
}

export async function setNegotiationStage(id: number, stage: string): Promise<boolean> {
  const pool = getPortalPool();
  if (!pool) return false;
  const c = await pool.connect();
  try {
    const row = await repo.getNegotiation(c, id);
    if (!row) return false;
    await repo.updateNegotiation(c, id, { stage });
    return true;
  } finally {
    c.release();
  }
}

export async function appendOutboundSmsLog(params: {
  negotiationId: number;
  body: string;
  templateKey: string;
  providerId?: string | null;
}): Promise<void> {
  const pool = getPortalPool();
  if (!pool) return;
  const c = await pool.connect();
  try {
    await repo.insertNegotiationMessage(c, {
      negotiation_id: params.negotiationId,
      direction: "out",
      body: params.body,
      provider_id: params.providerId ?? null,
      template_key: params.templateKey,
    });
    await repo.updateNegotiation(c, params.negotiationId, {});
  } finally {
    c.release();
  }
}
