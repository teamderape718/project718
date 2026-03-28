import { createPublicKey, verify } from "node:crypto";
import { loadEnv } from "../config/env.js";

/**
 * Vérifie la signature Ed25519 Telnyx (headers telnyx-signature-ed25519 + telnyx-timestamp).
 * @see https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks
 */
export function verifyTelnyxWebhook(
  rawBodyUtf8: string,
  signatureB64: string | undefined,
  timestamp: string | undefined
): boolean {
  const env = loadEnv();
  const pubB64 = env.TELNYX_WEBHOOK_PUBLIC_KEY?.trim();
  if (!pubB64) {
    return env.NODE_ENV !== "production";
  }
  if (!signatureB64 || !timestamp) return false;
  const skewSec = 300;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > skewSec) return false;
  try {
    const msg = Buffer.from(`${timestamp}|${rawBodyUtf8}`, "utf8");
    const sig = Buffer.from(signatureB64, "base64");
    const key = createPublicKey({
      key: Buffer.from(pubB64, "base64"),
      format: "der",
      type: "spki",
    });
    return verify(null, msg, key, sig);
  } catch {
    return false;
  }
}
