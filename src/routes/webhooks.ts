import type { FastifyInstance, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { loadEnv } from "../config/env.js";
import { getPortalPool } from "../portal/db-access.js";
import * as repo from "../portal/repo.js";
import { notifyTelegramHtml } from "../services/telegram-notify.js";
import { getStripe } from "../services/stripe-checkout.js";
import { normalizeToE164 } from "../utils/phone.js";
import { verifyTelnyxWebhook } from "../services/telnyx-webhook-verify.js";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function registerWebhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/stripe", async (request, reply) => {
    const stripe = getStripe();
    const whSecret = loadEnv().STRIPE_WEBHOOK_SECRET?.trim();
    if (!stripe || !whSecret) {
      return reply.status(503).send({ error: "Stripe webhook non configuré" });
    }
    const sig = request.headers["stripe-signature"];
    const buf = (request as FastifyRequest & { rawWebhookBody?: Buffer }).rawWebhookBody;
    if (!buf || typeof sig !== "string") {
      return reply.status(400).send({ error: "Corps ou signature manquant" });
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(buf, sig, whSecret);
    } catch {
      return reply.status(400).send({ error: "Signature Stripe invalide" });
    }

    const pool = getPortalPool();
    if (!pool) return reply.status(503).send({ error: "Base indisponible" });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      const amountCad =
        session.amount_total != null ? session.amount_total / 100 : null;
      const lineItems = [
        {
          merch_id: session.metadata?.merch_id ?? null,
          merch_name: session.metadata?.merch_name ?? null,
        },
      ];
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const ins = await client.query<{ id: string }>(
          `INSERT INTO stripe_webhook_events (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id`,
          [event.id]
        );
        if (ins.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.send({ received: true, duplicate: true });
        }
        await repo.markOrderPaidFromStripe(client, {
          stripe_session_id: sessionId,
          stripe_payment_intent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          customer_email: session.customer_details?.email ?? session.customer_email ?? null,
          amount_cad: amountCad,
          line_items: lineItems,
        });
        await client.query("COMMIT");
        const who = escHtml(session.customer_details?.email ?? session.customer_email ?? "client");
        const name = escHtml(session.metadata?.merch_name ?? "merch");
        const env = loadEnv();
        const base = env.PUBLIC_SITE_URL?.replace(/\/$/, "");
        const inline_keyboard =
          base != null
            ? [
                [
                  { text: "🛒 Commandes (admin)", url: `${base}/admin/panel?tab=orders` },
                  { text: "⚙️ Admin", url: `${base}/admin/panel` },
                ],
              ]
            : undefined;
        await notifyTelegramHtml(
          `<b>Commande Stripe payée</b>\n${name}\n${amountCad != null ? `${amountCad} CAD\n` : ""}${who}`,
          inline_keyboard ? { inline_keyboard } : undefined
        );
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        request.log.error(e);
        return reply.status(500).send({ error: "Erreur traitement webhook" });
      } finally {
        client.release();
      }
      return reply.send({ received: true });
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const piId = pi.id;
      const cents = pi.amount_received ?? pi.amount;
      const amountCad = cents != null ? cents / 100 : null;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const ins = await client.query<{ id: string }>(
          `INSERT INTO stripe_webhook_events (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id`,
          [event.id]
        );
        if (ins.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.send({ received: true, duplicate: true });
        }
        await repo.markOrderPaidByPaymentIntent(client, {
          stripe_payment_intent: piId,
          amount_cad: amountCad,
        });
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        request.log.error(e);
        return reply.status(500).send({ error: "Erreur traitement webhook" });
      } finally {
        client.release();
      }
      return reply.send({ received: true });
    }

    return reply.send({ received: true });
  });

  app.post("/webhooks/telnyx", async (request, reply) => {
    const buf = (request as FastifyRequest & { rawWebhookBody?: Buffer }).rawWebhookBody;
    if (!buf) return reply.status(400).send({ error: "Corps manquant" });
    const rawUtf8 = buf.toString("utf8");
    const sig =
      (request.headers["telnyx-signature-ed25519"] as string | undefined) ||
      (request.headers["Telnyx-Signature-Ed25519"] as string | undefined);
    const ts =
      (request.headers["telnyx-timestamp"] as string | undefined) ||
      (request.headers["Telnyx-Timestamp"] as string | undefined);
    if (!verifyTelnyxWebhook(rawUtf8, sig, ts)) {
      return reply.status(401).send({ error: "Signature Telnyx invalide" });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawUtf8);
    } catch {
      return reply.status(400).send({ error: "JSON invalide" });
    }
    const b = body as {
      data?: {
        event_type?: string;
        payload?: Record<string, unknown>;
        record?: Record<string, unknown>;
      };
    };
    const eventType = b.data?.event_type;
    const payload = (b.data?.payload ?? b.data?.record) as Record<string, unknown> | undefined;
    if (eventType !== "message.received" || !payload) {
      return reply.send({ received: true });
    }

    const text =
      (payload.text as string) ||
      (payload.body as string) ||
      ((payload.payload as Record<string, unknown>)?.text as string) ||
      "";
    const media = (payload.media as Array<{ url?: string }> | undefined) ?? [];
    const fromRaw =
      (payload.from as { phone_number?: string; number?: string })?.phone_number ||
      (payload.from as { phone_number?: string; number?: string })?.number ||
      "";
    const providerId = typeof payload.id === "string" ? payload.id : null;
    const phone = normalizeToE164(fromRaw);
    const trimmedText = text.trim();
    const bodyForDb =
      trimmedText ||
      (media.length > 0 ? `[MMS: ${media.length} pièce(s)]` : "");
    if (!phone || !bodyForDb) {
      return reply.send({ received: true });
    }

    const pool = getPortalPool();
    if (!pool) return reply.status(503).send({ error: "Base indisponible" });
    const client = await pool.connect();
    try {
      let negoId = await repo.findNegotiationIdBySellerPhone(client, phone);
      if (negoId == null) {
        negoId = await repo.insertNegotiation(client, {
          source: "sms_inbound",
          listing_url: null,
          title: "SMS entrant (sans deal lié)",
          seller_phone: phone,
          stage: "new",
          notes: "Créé automatiquement depuis Telnyx (webhook)",
        });
      }
      const inserted = await repo.insertInboundNegotiationMessage(client, {
        negotiation_id: negoId,
        body: bodyForDb,
        provider_id: providerId,
      });
      if (!inserted) {
        return reply.send({ received: true, duplicate: true });
      }
      await repo.updateNegotiation(client, negoId, {});
      const env = loadEnv();
      const base = env.PUBLIC_SITE_URL?.replace(/\/$/, "");
      const botUser = env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim();
      const rows: { text: string; url: string }[][] = [];
      if (base) {
        rows.push([
          { text: "🤝 Admin négociations", url: `${base}/admin/panel?tab=negotiations` },
        ]);
      }
      if (botUser) {
        rows.push([
          { text: `💬 Deal #${negoId} (bot)`, url: `https://t.me/${botUser}?start=nego_${negoId}` },
        ]);
      }
      await notifyTelegramHtml(
        `<b>SMS reçu</b> (#${negoId})\nDe: <code>${escHtml(phone)}</code>\n${escHtml(bodyForDb.slice(0, 400))}`,
        rows.length ? { inline_keyboard: rows } : undefined
      );
    } catch (e) {
      request.log.error(e);
      return reply.status(500).send({ error: "Erreur persistance SMS" });
    } finally {
      client.release();
    }
    return reply.send({ received: true });
  });
}
