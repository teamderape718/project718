import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { loadEnv } from "../config/env.js";
import { getPortalPool } from "../portal/db-access.js";
import { hashPassword, verifyPassword } from "../portal/password.js";
import * as repo from "../portal/repo.js";
import {
  createMerchCheckoutSession,
  getStripe,
  stripePaymentsDashboardBase,
} from "../services/stripe-checkout.js";
import {
  buildSmsFromTemplate,
  isSmsTemplateKey,
  validateSmsBodyLength,
  validateSmsTemplatePayload,
} from "../services/sms-templates.js";
import { smsWithTemplate } from "../services/telnyx-sms.js";
import { normalizeToE164 } from "../utils/phone.js";

async function authAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
    if (req.user.role !== "admin") {
      return reply.status(403).send({ error: "Réservé aux administrateurs" });
    }
  } catch {
    return reply.status(401).send({ error: "Non autorisé" });
  }
}

async function authClient(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
    if (req.user.role !== "client") {
      return reply.status(403).send({ error: "Réservé aux comptes client" });
    }
  } catch {
    return reply.status(401).send({ error: "Non autorisé" });
  }
}

function noDb(reply: FastifyReply) {
  return reply.status(503).send({
    error: "PostgreSQL requis (DATABASE_URL). Lancez npm run db:migrate.",
  });
}

export async function registerPortalRoutes(app: FastifyInstance) {
  const env = loadEnv();
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: "7d" },
  });

  app.post<{
    Body: { email?: string; password?: string };
  }>("/api/admin/login", async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const email = request.body?.email?.trim();
    const password = request.body?.password;
    if (!email || !password) {
      return reply.status(400).send({ error: "email et mot de passe requis" });
    }
    const client = await pool.connect();
    try {
      const row = await repo.findAdminByEmail(client, email);
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        return reply.status(401).send({ error: "Identifiants invalides" });
      }
      const token = await reply.jwtSign({
        sub: String(row.id),
        email: row.email ?? email,
        role: "admin",
      });
      return { token };
    } finally {
      client.release();
    }
  });

  app.get("/api/public/videos", async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listPublicVideos(client);
    } finally {
      client.release();
    }
  });

  app.get("/api/public/merch", async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listPublicMerch(client);
    } finally {
      client.release();
    }
  });

  app.get("/api/public/inventory", async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listPublicInventory(client);
    } finally {
      client.release();
    }
  });

  app.get("/api/public/vehicle-projects", async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listPublicVehicleProjects(client);
    } finally {
      client.release();
    }
  });

  app.get<{
    Params: { slug: string };
  }>("/api/public/vehicle-projects/:slug", async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const slug = request.params.slug?.trim();
    if (!slug) return reply.status(400).send({ error: "slug requis" });
    const client = await pool.connect();
    try {
      const row = await repo.getPublishedVehicleProjectBySlug(client, slug);
      if (!row) return reply.status(404).send({ error: "Projet introuvable" });
      return row;
    } finally {
      client.release();
    }
  });

  app.get("/api/public/site-meta", async () => {
    return {
      name: "TEAM DERAPE",
      siteUrl: env.PUBLIC_SITE_URL ?? null,
    };
  });

  app.post<{
    Body: { merch_id?: number; quantity?: number };
  }>("/api/public/checkout", async (request, reply) => {
    if (!getStripe()) {
      return reply.status(503).send({ error: "Paiement Stripe non configuré" });
    }
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const merchId = Number(request.body?.merch_id);
    const qty = Math.min(99, Math.max(1, Number(request.body?.quantity) || 1));
    if (!Number.isFinite(merchId)) {
      return reply.status(400).send({ error: "merch_id requis" });
    }
    const client = await pool.connect();
    try {
      const row = await repo.getMerchForCheckout(client, merchId);
      if (!row) {
        return reply.status(400).send({ error: "Produit non disponible au paiement en ligne" });
      }
      const session = await createMerchCheckoutSession({
        stripePriceId: row.stripe_price_id,
        merchId: row.id,
        merchName: row.name,
        quantity: qty,
      });
      await repo.insertOrderPending(client, {
        stripe_session_id: session.id,
        customer_email: null,
        line_items: [{ merch_id: row.id, name: row.name, quantity: qty }],
      });
      if (!session.url) {
        return reply.status(500).send({ error: "Session Stripe sans URL" });
      }
      return { url: session.url };
    } catch (e) {
      request.log.error(e);
      return reply
        .status(500)
        .send({ error: e instanceof Error ? e.message : "Échec création session" });
    } finally {
      client.release();
    }
  });

  const admin = {
    preHandler: authAdmin,
  };

  app.get("/api/admin/videos", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listAllVideos(client);
    } finally {
      client.release();
    }
  });

  app.post<{
    Body: {
      title: string;
      video_url: string;
      description?: string;
      thumbnail_url?: string | null;
      sort_order?: number;
      published?: boolean;
    };
  }>("/api/admin/videos", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    if (!request.body?.title || !request.body?.video_url) {
      return reply.status(400).send({ error: "title et video_url requis" });
    }
    const client = await pool.connect();
    try {
      const id = await repo.insertVideo(client, request.body);
      return { id };
    } finally {
      client.release();
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>("/api/admin/videos/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: "id invalide" });
    const client = await pool.connect();
    try {
      await repo.updateVideo(client, id, request.body as Parameters<typeof repo.updateVideo>[2]);
      return { ok: true };
    } finally {
      client.release();
    }
  });

  app.delete<{
    Params: { id: string };
  }>("/api/admin/videos/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    const client = await pool.connect();
    try {
      await repo.deleteVideo(client, id);
      return { ok: true };
    } finally {
      client.release();
    }
  });

  app.get("/api/admin/merch", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listAllMerch(client);
    } finally {
      client.release();
    }
  });

  app.get("/api/admin/dashboard", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.getDashboardStats(client);
    } finally {
      client.release();
    }
  });

  app.get("/api/admin/orders", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      const orders = await repo.listOrdersAdmin(client);
      return {
        orders,
        stripe_payments_base_url: stripePaymentsDashboardBase(),
      };
    } finally {
      client.release();
    }
  });

  app.get<{
    Params: { id: string };
  }>("/api/admin/negotiations/:id/messages", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: "id invalide" });
    const client = await pool.connect();
    try {
      return await repo.listNegotiationMessages(client, id);
    } finally {
      client.release();
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      template_key: string;
      model_label?: string;
      slots_text?: string;
      when_where?: string;
    };
  }>("/api/admin/negotiations/:id/sms", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: "id invalide" });
    const key = request.body?.template_key;
    if (!key || !isSmsTemplateKey(key)) {
      return reply.status(400).send({ error: "template_key invalide" });
    }
    const client = await pool.connect();
    try {
      const nego = await repo.getNegotiation(client, id);
      if (!nego) return reply.status(404).send({ error: "Négociation introuvable" });
      const phone = normalizeToE164(nego.seller_phone ?? "");
      if (!phone) {
        return reply.status(400).send({ error: "Numéro vendeur manquant ou invalide" });
      }
      const slotsText = request.body?.slots_text;
      const whenWhere = request.body?.when_where;
      const vPre = validateSmsTemplatePayload(key, { slotsText, whenWhere });
      if (!vPre.ok) return reply.status(400).send({ error: vPre.error });
      const previewBody = buildSmsFromTemplate(key, {
        modelLabel: request.body?.model_label ?? nego.title ?? undefined,
        slotsText,
        whenWhere,
      });
      const vLen = validateSmsBodyLength(previewBody);
      if (!vLen.ok) return reply.status(400).send({ error: vLen.error });
      const res = await smsWithTemplate({
        toE164: phone,
        template: key,
        modelLabel: request.body?.model_label ?? nego.title ?? undefined,
        slotsText,
        whenWhere,
      });
      const bodyText = previewBody;
      await repo.insertNegotiationMessage(client, {
        negotiation_id: id,
        direction: "out",
        body: bodyText,
        provider_id: res.data?.id ?? null,
        template_key: key,
      });
      await repo.updateNegotiation(client, id, {});
      return { ok: true, provider_id: res.data?.id ?? null };
    } catch (e) {
      request.log.error(e);
      return reply.status(500).send({
        error: e instanceof Error ? e.message : "Échec envoi SMS",
      });
    } finally {
      client.release();
    }
  });

  app.post<{
    Body: {
      name: string;
      description?: string;
      price_cad?: number | null;
      image_url?: string | null;
      external_url?: string | null;
      stripe_price_id?: string | null;
      sort_order?: number;
      published?: boolean;
    };
  }>("/api/admin/merch", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    if (!request.body?.name) {
      return reply.status(400).send({ error: "name requis" });
    }
    const client = await pool.connect();
    try {
      const id = await repo.insertMerch(client, request.body);
      return { id };
    } finally {
      client.release();
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>("/api/admin/merch/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    const client = await pool.connect();
    try {
      await repo.updateMerch(client, id, request.body as Parameters<typeof repo.updateMerch>[2]);
      return { ok: true };
    } finally {
      client.release();
    }
  });

  app.delete<{
    Params: { id: string };
  }>("/api/admin/merch/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    const client = await pool.connect();
    try {
      await repo.deleteMerch(client, id);
      return { ok: true };
    } finally {
      client.release();
    }
  });

  app.get("/api/admin/inventory", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listAllInventory(client);
    } finally {
      client.release();
    }
  });

  app.post<{
    Body: {
      category: string;
      title: string;
      subtitle?: string;
      details?: string;
      status?: string;
      image_urls?: string[];
      sort_order?: number;
    };
  }>("/api/admin/inventory", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    if (!request.body?.category || !request.body?.title) {
      return reply.status(400).send({ error: "category et title requis" });
    }
    const client = await pool.connect();
    try {
      const id = await repo.insertInventory(client, request.body);
      return { id };
    } finally {
      client.release();
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>("/api/admin/inventory/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    const client = await pool.connect();
    try {
      await repo.updateInventory(
        client,
        id,
        request.body as Parameters<typeof repo.updateInventory>[2]
      );
      return { ok: true };
    } finally {
      client.release();
    }
  });

  app.delete<{
    Params: { id: string };
  }>("/api/admin/inventory/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    const client = await pool.connect();
    try {
      await repo.deleteInventory(client, id);
      return { ok: true };
    } finally {
      client.release();
    }
  });

  const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  function validVehicleSlug(s: string): boolean {
    return s.length >= 1 && s.length <= 120 && slugRe.test(s);
  }

  app.get("/api/admin/vehicle-projects", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listAllVehicleProjectsWithMedia(client);
    } finally {
      client.release();
    }
  });

  app.post<{
    Body: {
      slug?: string;
      title?: string;
      summary?: string;
      sort_order?: number;
      published?: boolean;
    };
  }>("/api/admin/vehicle-projects", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const slug = request.body?.slug?.trim().toLowerCase() ?? "";
    const title = request.body?.title?.trim() ?? "";
    if (!slug || !title) {
      return reply.status(400).send({ error: "slug et title requis" });
    }
    if (!validVehicleSlug(slug)) {
      return reply.status(400).send({
        error: "slug invalide (lettres minuscules, chiffres, tirets)",
      });
    }
    const client = await pool.connect();
    try {
      const id = await repo.insertVehicleProject(client, {
        slug,
        title,
        summary: request.body?.summary,
        sort_order: request.body?.sort_order,
        published: request.body?.published,
      });
      return { id };
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "23505") {
        return reply.status(409).send({ error: "Ce slug existe déjà" });
      }
      throw e;
    } finally {
      client.release();
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>("/api/admin/vehicle-projects/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: "id invalide" });
    const body = request.body as {
      slug?: string;
      title?: string;
      summary?: string;
      sort_order?: number;
      published?: boolean;
    };
    const patch: Parameters<typeof repo.updateVehicleProject>[2] = {};
    if (body.slug !== undefined) {
      const s = body.slug.trim().toLowerCase();
      if (!validVehicleSlug(s)) {
        return reply.status(400).send({
          error: "slug invalide (lettres minuscules, chiffres, tirets)",
        });
      }
      patch.slug = s;
    }
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.summary !== undefined) patch.summary = body.summary;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
    if (body.published !== undefined) patch.published = body.published;
    const client = await pool.connect();
    try {
      await repo.updateVehicleProject(client, id, patch);
      return { ok: true };
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "23505") {
        return reply.status(409).send({ error: "Ce slug existe déjà" });
      }
      throw e;
    } finally {
      client.release();
    }
  });

  app.delete<{
    Params: { id: string };
  }>("/api/admin/vehicle-projects/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    const client = await pool.connect();
    try {
      await repo.deleteVehicleProject(client, id);
      return { ok: true };
    } finally {
      client.release();
    }
  });

  app.post<{
    Params: { id: string };
    Body: {
      media_type?: string;
      url?: string;
      caption?: string;
      sort_order?: number;
    };
  }>("/api/admin/vehicle-projects/:id/media", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const projectId = Number(request.params.id);
    if (!Number.isFinite(projectId)) return reply.status(400).send({ error: "id invalide" });
    const mediaType = request.body?.media_type;
    const url = request.body?.url?.trim() ?? "";
    if (mediaType !== "image" && mediaType !== "video") {
      return reply.status(400).send({ error: "media_type doit être image ou video" });
    }
    if (!url) return reply.status(400).send({ error: "url requis" });
    const client = await pool.connect();
    try {
      const mediaId = await repo.insertVehicleProjectMedia(client, projectId, {
        media_type: mediaType,
        url,
        caption: request.body?.caption,
        sort_order: request.body?.sort_order,
      });
      return { id: mediaId };
    } finally {
      client.release();
    }
  });

  app.patch<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>("/api/admin/vehicle-project-media/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: "id invalide" });
    const body = request.body as {
      media_type?: string;
      url?: string;
      caption?: string;
      sort_order?: number;
    };
    const patch: Parameters<typeof repo.updateVehicleProjectMedia>[2] = {};
    if (body.media_type !== undefined) {
      if (body.media_type !== "image" && body.media_type !== "video") {
        return reply.status(400).send({ error: "media_type doit être image ou video" });
      }
      patch.media_type = body.media_type;
    }
    if (body.url !== undefined) patch.url = body.url.trim();
    if (body.caption !== undefined) patch.caption = body.caption;
    if (body.sort_order !== undefined) patch.sort_order = body.sort_order;
    const client = await pool.connect();
    try {
      await repo.updateVehicleProjectMedia(client, id, patch);
      return { ok: true };
    } finally {
      client.release();
    }
  });

  app.delete<{
    Params: { id: string };
  }>("/api/admin/vehicle-project-media/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    const client = await pool.connect();
    try {
      await repo.deleteVehicleProjectMedia(client, id);
      return { ok: true };
    } finally {
      client.release();
    }
  });

  app.get("/api/admin/negotiations/stats", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.getAdminPipelineStats(client);
    } finally {
      client.release();
    }
  });

  app.get("/api/admin/negotiations", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listNegotiationsAdmin(client);
    } finally {
      client.release();
    }
  });

  app.patch<{
    Params: { id: string };
    Body: { stage?: string; notes?: string };
  }>("/api/admin/negotiations/:id", admin, async (request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const id = Number(request.params.id);
    const client = await pool.connect();
    try {
      await repo.updateNegotiation(client, id, request.body);
      return { ok: true };
    } finally {
      client.release();
    }
  });
}
