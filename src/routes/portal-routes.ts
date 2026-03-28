import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { loadEnv } from "../config/env.js";
import { getPortalPool } from "../portal/db-access.js";
import { hashPassword, verifyPassword } from "../portal/password.js";
import * as repo from "../portal/repo.js";

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

  app.get("/api/public/site-meta", async () => {
    return {
      name: "TEAM DERAPE",
      siteUrl: env.PUBLIC_SITE_URL ?? null,
    };
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

  app.post<{
    Body: {
      name: string;
      description?: string;
      price_cad?: number | null;
      image_url?: string | null;
      external_url?: string | null;
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

  app.get("/api/admin/negotiations", admin, async (_request, reply) => {
    const pool = getPortalPool();
    if (!pool) return noDb(reply);
    const client = await pool.connect();
    try {
      return await repo.listNegotiations(client);
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
