import type { Pool, PoolClient } from "pg";

export type SiteVideoRow = {
  id: number;
  title: string;
  video_url: string;
  description: string;
  thumbnail_url: string | null;
  sort_order: number;
  published: boolean;
  created_at: Date;
};

export type MerchRow = {
  id: number;
  name: string;
  description: string;
  price_cad: string | null;
  image_url: string | null;
  external_url: string | null;
  stripe_price_id: string | null;
  sort_order: number;
  published: boolean;
  created_at: Date;
};

export type InventoryRow = {
  id: number;
  category: string;
  title: string;
  subtitle: string;
  details: string;
  status: string;
  image_urls: string[];
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type NegotiationRow = {
  id: number;
  source: string;
  listing_url: string | null;
  title: string | null;
  seller_phone: string | null;
  stage: string;
  notes: string;
  last_action_at: Date;
  created_at: Date;
};

export type NegotiationMessageRow = {
  id: string;
  negotiation_id: number;
  direction: string;
  body: string;
  provider_id: string | null;
  template_key: string | null;
  created_at: Date;
};

export type NegotiationAdminRow = NegotiationRow & {
  message_count: number;
  last_message_body: string | null;
  last_message_direction: string | null;
  last_message_at: Date | null;
};

export type AdminPipelineStats = {
  orders_last_7d: number;
  active_deals: number;
  pending_sms_reply: number;
};

export type OrderRow = {
  id: number;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  customer_email: string | null;
  amount_cad: string | null;
  currency: string;
  status: string;
  line_items: unknown;
  created_at: Date;
  updated_at: Date;
};

export type VehicleProjectRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  sort_order: number;
  published: boolean;
  created_at: Date;
  updated_at: Date;
};

export type VehicleProjectMediaRow = {
  id: number;
  project_id: number;
  media_type: string;
  url: string;
  caption: string;
  sort_order: number;
  created_at: Date;
};

export async function listPublicVideos(client: Pool | PoolClient): Promise<SiteVideoRow[]> {
  const r = await client.query<SiteVideoRow>(
    `SELECT * FROM site_videos WHERE published = true ORDER BY sort_order ASC, id DESC`
  );
  return r.rows;
}

export async function listPublicMerch(client: Pool | PoolClient): Promise<MerchRow[]> {
  const r = await client.query<MerchRow>(
    `SELECT * FROM merch_products WHERE published = true ORDER BY sort_order ASC, id DESC`
  );
  return r.rows;
}

export async function listPublicInventory(client: Pool | PoolClient): Promise<InventoryRow[]> {
  const r = await client.query<InventoryRow>(
    `SELECT * FROM inventory_items
     WHERE status IN ('available', 'reserved')
     ORDER BY sort_order ASC, id DESC`
  );
  return r.rows;
}

export async function listAllVideos(client: Pool | PoolClient): Promise<SiteVideoRow[]> {
  const r = await client.query<SiteVideoRow>(
    `SELECT * FROM site_videos ORDER BY sort_order ASC, id DESC`
  );
  return r.rows;
}

export async function listAllMerch(client: Pool | PoolClient): Promise<MerchRow[]> {
  const r = await client.query<MerchRow>(
    `SELECT * FROM merch_products ORDER BY sort_order ASC, id DESC`
  );
  return r.rows;
}

export async function listAllInventory(client: Pool | PoolClient): Promise<InventoryRow[]> {
  const r = await client.query<InventoryRow>(
    `SELECT * FROM inventory_items ORDER BY sort_order ASC, id DESC`
  );
  return r.rows;
}

export async function listNegotiations(client: Pool | PoolClient): Promise<NegotiationRow[]> {
  const r = await client.query<NegotiationRow>(
    `SELECT * FROM negotiations ORDER BY last_action_at DESC`
  );
  return r.rows;
}

export async function listNegotiationsAdmin(
  client: Pool | PoolClient
): Promise<NegotiationAdminRow[]> {
  const r = await client.query<
    NegotiationRow & {
      message_count: string;
      last_message_body: string | null;
      last_message_direction: string | null;
      last_message_at: Date | null;
    }
  >(
    `SELECT n.*,
      (SELECT count(*)::text FROM negotiation_messages m WHERE m.negotiation_id = n.id) AS message_count,
      (SELECT m.body FROM negotiation_messages m WHERE m.negotiation_id = n.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_body,
      (SELECT m.direction FROM negotiation_messages m WHERE m.negotiation_id = n.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_direction,
      (SELECT m.created_at FROM negotiation_messages m WHERE m.negotiation_id = n.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
     FROM negotiations n
     ORDER BY n.last_action_at DESC`
  );
  return r.rows.map((row) => ({
    id: row.id,
    source: row.source,
    listing_url: row.listing_url,
    title: row.title,
    seller_phone: row.seller_phone,
    stage: row.stage,
    notes: row.notes,
    last_action_at: row.last_action_at,
    created_at: row.created_at,
    message_count: Number(row.message_count ?? 0),
    last_message_body: row.last_message_body,
    last_message_direction: row.last_message_direction,
    last_message_at: row.last_message_at,
  }));
}

export async function listNegotiationMessages(
  client: Pool | PoolClient,
  negotiationId: number
): Promise<NegotiationMessageRow[]> {
  const r = await client.query<
    Omit<NegotiationMessageRow, "id"> & { id: bigint | number }
  >(
    `SELECT id, negotiation_id, direction, body, provider_id, template_key, created_at
     FROM negotiation_messages
     WHERE negotiation_id = $1
     ORDER BY created_at ASC`,
    [negotiationId]
  );
  return r.rows.map((m) => ({
    ...m,
    id: String(m.id),
  }));
}

export async function getAdminPipelineStats(
  client: Pool | PoolClient
): Promise<AdminPipelineStats> {
  const orders = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM orders WHERE created_at >= NOW() - INTERVAL '7 days'`
  );
  const active = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM negotiations WHERE stage NOT IN ('won', 'lost')`
  );
  const pendingSms = await client.query<{ c: string }>(
    `WITH last_per_nego AS (
       SELECT DISTINCT ON (negotiation_id) negotiation_id, direction
       FROM negotiation_messages
       ORDER BY negotiation_id, created_at DESC
     )
     SELECT count(*)::text AS c
     FROM negotiations n
     INNER JOIN last_per_nego l ON l.negotiation_id = n.id
     WHERE l.direction = 'in' AND n.stage NOT IN ('won', 'lost')`
  );
  return {
    orders_last_7d: Number(orders.rows[0]?.c ?? 0),
    active_deals: Number(active.rows[0]?.c ?? 0),
    pending_sms_reply: Number(pendingSms.rows[0]?.c ?? 0),
  };
}

export async function insertNegotiation(
  client: Pool | PoolClient,
  row: {
    source?: string;
    listing_url?: string | null;
    title?: string | null;
    seller_phone?: string | null;
    stage?: string;
    notes?: string;
  }
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO negotiations (source, listing_url, title, seller_phone, stage, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [
      row.source ?? "kijiji",
      row.listing_url ?? null,
      row.title ?? null,
      row.seller_phone ?? null,
      row.stage ?? "new",
      row.notes ?? "",
    ]
  );
  return r.rows[0]!.id;
}

export async function updateNegotiation(
  client: Pool | PoolClient,
  id: number,
  patch: Partial<{ stage: string; notes: string }>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) {
    await client.query(`UPDATE negotiations SET last_action_at = NOW() WHERE id = $1`, [id]);
    return;
  }
  const sets = [...entries.map(([k], i) => `${k} = $${i + 1}`), "last_action_at = NOW()"];
  const vals = entries.map(([, v]) => v);
  vals.push(id);
  await client.query(
    `UPDATE negotiations SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals
  );
}

export async function upsertKv(
  client: Pool | PoolClient,
  key: string,
  value: unknown
): Promise<void> {
  await client.query(
    `INSERT INTO app_kv (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

export async function getKv(
  client: Pool | PoolClient,
  key: string
): Promise<unknown | null> {
  const r = await client.query<{ value: unknown }>(
    `SELECT value FROM app_kv WHERE key = $1`,
    [key]
  );
  return r.rows[0]?.value ?? null;
}

export async function insertVideo(
  client: Pool | PoolClient,
  body: {
    title: string;
    video_url: string;
    description?: string;
    thumbnail_url?: string | null;
    sort_order?: number;
    published?: boolean;
  }
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO site_videos (title, video_url, description, thumbnail_url, sort_order, published)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [
      body.title,
      body.video_url,
      body.description ?? "",
      body.thumbnail_url ?? null,
      body.sort_order ?? 0,
      body.published ?? false,
    ]
  );
  return r.rows[0]!.id;
}

export async function updateVideo(
  client: Pool | PoolClient,
  id: number,
  patch: Partial<{
    title: string;
    video_url: string;
    description: string;
    thumbnail_url: string | null;
    sort_order: number;
    published: boolean;
  }>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`);
  const vals = entries.map(([, v]) => v);
  vals.push(id);
  await client.query(
    `UPDATE site_videos SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals
  );
}

export async function deleteVideo(client: Pool | PoolClient, id: number): Promise<void> {
  await client.query(`DELETE FROM site_videos WHERE id = $1`, [id]);
}

export async function insertMerch(
  client: Pool | PoolClient,
  body: {
    name: string;
    description?: string;
    price_cad?: number | null;
    image_url?: string | null;
    external_url?: string | null;
    stripe_price_id?: string | null;
    sort_order?: number;
    published?: boolean;
  }
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO merch_products (name, description, price_cad, image_url, external_url, stripe_price_id, sort_order, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      body.name,
      body.description ?? "",
      body.price_cad ?? null,
      body.image_url ?? null,
      body.external_url ?? null,
      body.stripe_price_id ?? null,
      body.sort_order ?? 0,
      body.published ?? false,
    ]
  );
  return r.rows[0]!.id;
}

export async function updateMerch(
  client: Pool | PoolClient,
  id: number,
  patch: Partial<{
    name: string;
    description: string;
    price_cad: number | null;
    image_url: string | null;
    external_url: string | null;
    stripe_price_id: string | null;
    sort_order: number;
    published: boolean;
  }>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`);
  const vals = entries.map(([, v]) => v);
  vals.push(id);
  await client.query(
    `UPDATE merch_products SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals
  );
}

export async function deleteMerch(client: Pool | PoolClient, id: number): Promise<void> {
  await client.query(`DELETE FROM merch_products WHERE id = $1`, [id]);
}

export async function getMerchForCheckout(
  client: Pool | PoolClient,
  id: number
): Promise<{ id: number; name: string; stripe_price_id: string } | null> {
  const r = await client.query<{ id: number; name: string; stripe_price_id: string }>(
    `SELECT id, name, stripe_price_id FROM merch_products
     WHERE id = $1 AND published = true
       AND stripe_price_id IS NOT NULL AND trim(stripe_price_id) <> ''`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function insertInventory(
  client: Pool | PoolClient,
  body: {
    category: string;
    title: string;
    subtitle?: string;
    details?: string;
    status?: string;
    image_urls?: string[];
    sort_order?: number;
  }
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO inventory_items (category, title, subtitle, details, status, image_urls, sort_order, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id`,
    [
      body.category,
      body.title,
      body.subtitle ?? "",
      body.details ?? "",
      body.status ?? "draft",
      body.image_urls ?? [],
      body.sort_order ?? 0,
    ]
  );
  return r.rows[0]!.id;
}

export async function updateInventory(
  client: Pool | PoolClient,
  id: number,
  patch: Partial<{
    category: string;
    title: string;
    subtitle: string;
    details: string;
    status: string;
    image_urls: string[];
    sort_order: number;
  }>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`);
  sets.push(`updated_at = NOW()`);
  const vals = entries.map(([, v]) => v);
  vals.push(id);
  await client.query(
    `UPDATE inventory_items SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals
  );
}

export async function deleteInventory(client: Pool | PoolClient, id: number): Promise<void> {
  await client.query(`DELETE FROM inventory_items WHERE id = $1`, [id]);
}

export async function findAdminByEmail(
  client: Pool | PoolClient,
  email: string
): Promise<{ id: number; email: string; password_hash: string } | null> {
  const r = await client.query<{ id: number; email: string; password_hash: string }>(
    `SELECT id, email, password_hash FROM admin_users WHERE lower(email) = lower($1)`,
    [email]
  );
  return r.rows[0] ?? null;
}

export async function countAdmins(client: Pool | PoolClient): Promise<number> {
  const r = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM admin_users`);
  return Number(r.rows[0]?.c ?? 0);
}

export async function insertAdmin(
  client: Pool | PoolClient,
  email: string,
  passwordHash: string
): Promise<void> {
  await client.query(
    `INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)`,
    [email.toLowerCase(), passwordHash]
  );
}

export async function findClientByEmail(
  client: Pool | PoolClient,
  email: string
): Promise<{ id: number; password_hash: string } | null> {
  const r = await client.query<{ id: number; password_hash: string }>(
    `SELECT id, password_hash FROM client_users WHERE lower(email) = lower($1)`,
    [email]
  );
  return r.rows[0] ?? null;
}

export async function insertClient(
  client: Pool | PoolClient,
  email: string,
  passwordHash: string
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO client_users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [email.toLowerCase(), passwordHash]
  );
  return r.rows[0]!.id;
}

export type VehicleProjectListPublicRow = VehicleProjectRow & { cover_url: string | null };

export type VehicleProjectWithMedia = VehicleProjectRow & { media: VehicleProjectMediaRow[] };

export async function listPublicVehicleProjects(
  client: Pool | PoolClient
): Promise<VehicleProjectListPublicRow[]> {
  const r = await client.query<VehicleProjectListPublicRow>(
    `SELECT vp.*,
      (SELECT m.url FROM vehicle_project_media m
       WHERE m.project_id = vp.id
       ORDER BY m.sort_order ASC, m.id ASC
       LIMIT 1) AS cover_url
     FROM vehicle_projects vp
     WHERE vp.published = true
     ORDER BY vp.sort_order ASC, vp.id DESC`
  );
  return r.rows;
}

export async function getPublishedVehicleProjectBySlug(
  client: Pool | PoolClient,
  slug: string
): Promise<VehicleProjectWithMedia | null> {
  const pr = await client.query<VehicleProjectRow>(
    `SELECT * FROM vehicle_projects WHERE slug = $1 AND published = true`,
    [slug]
  );
  const project = pr.rows[0];
  if (!project) return null;
  const mr = await client.query<VehicleProjectMediaRow>(
    `SELECT * FROM vehicle_project_media WHERE project_id = $1 ORDER BY sort_order ASC, id ASC`,
    [project.id]
  );
  return { ...project, media: mr.rows };
}

export async function listAllVehicleProjectsWithMedia(
  client: Pool | PoolClient
): Promise<VehicleProjectWithMedia[]> {
  const projects = await client.query<VehicleProjectRow>(
    `SELECT * FROM vehicle_projects ORDER BY sort_order ASC, id DESC`
  );
  if (!projects.rows.length) return [];
  const ids = projects.rows.map((p) => p.id);
  const mr = await client.query<VehicleProjectMediaRow>(
    `SELECT * FROM vehicle_project_media WHERE project_id = ANY($1::int[])
     ORDER BY project_id, sort_order ASC, id ASC`,
    [ids]
  );
  const byProject = new Map<number, VehicleProjectMediaRow[]>();
  for (const row of mr.rows) {
    const arr = byProject.get(row.project_id) ?? [];
    arr.push(row);
    byProject.set(row.project_id, arr);
  }
  return projects.rows.map((p) => ({ ...p, media: byProject.get(p.id) ?? [] }));
}

export async function insertVehicleProject(
  client: Pool | PoolClient,
  body: {
    slug: string;
    title: string;
    summary?: string;
    sort_order?: number;
    published?: boolean;
  }
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO vehicle_projects (slug, title, summary, sort_order, published, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id`,
    [
      body.slug,
      body.title,
      body.summary ?? "",
      body.sort_order ?? 0,
      body.published ?? false,
    ]
  );
  return r.rows[0]!.id;
}

export async function updateVehicleProject(
  client: Pool | PoolClient,
  id: number,
  patch: Partial<{
    slug: string;
    title: string;
    summary: string;
    sort_order: number;
    published: boolean;
  }>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`);
  sets.push(`updated_at = NOW()`);
  const vals = entries.map(([, v]) => v);
  vals.push(id);
  await client.query(
    `UPDATE vehicle_projects SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals
  );
}

export async function deleteVehicleProject(client: Pool | PoolClient, id: number): Promise<void> {
  await client.query(`DELETE FROM vehicle_projects WHERE id = $1`, [id]);
}

export async function insertVehicleProjectMedia(
  client: Pool | PoolClient,
  projectId: number,
  body: {
    media_type: string;
    url: string;
    caption?: string;
    sort_order?: number;
  }
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO vehicle_project_media (project_id, media_type, url, caption, sort_order)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [
      projectId,
      body.media_type,
      body.url,
      body.caption ?? "",
      body.sort_order ?? 0,
    ]
  );
  return r.rows[0]!.id;
}

export async function updateVehicleProjectMedia(
  client: Pool | PoolClient,
  id: number,
  patch: Partial<{
    media_type: string;
    url: string;
    caption: string;
    sort_order: number;
  }>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k], i) => `${k} = $${i + 1}`);
  const vals = entries.map(([, v]) => v);
  vals.push(id);
  await client.query(
    `UPDATE vehicle_project_media SET ${sets.join(", ")} WHERE id = $${vals.length}`,
    vals
  );
}

export async function deleteVehicleProjectMedia(client: Pool | PoolClient, id: number): Promise<void> {
  await client.query(`DELETE FROM vehicle_project_media WHERE id = $1`, [id]);
}

export async function listVehicleProjectMedia(
  client: Pool | PoolClient,
  projectId: number
): Promise<VehicleProjectMediaRow[]> {
  const r = await client.query<VehicleProjectMediaRow>(
    `SELECT * FROM vehicle_project_media WHERE project_id = $1 ORDER BY sort_order ASC, id ASC`,
    [projectId]
  );
  return r.rows;
}

export async function insertOrderPending(
  client: Pool | PoolClient,
  row: {
    stripe_session_id: string;
    customer_email: string | null;
    line_items: unknown;
  }
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO orders (stripe_session_id, customer_email, status, line_items, updated_at)
     VALUES ($1, $2, 'pending', $3::jsonb, NOW()) RETURNING id`,
    [row.stripe_session_id, row.customer_email, JSON.stringify(row.line_items ?? [])]
  );
  return r.rows[0]!.id;
}

export async function markOrderPaidFromStripe(
  client: Pool | PoolClient,
  params: {
    stripe_session_id: string;
    stripe_payment_intent: string | null;
    customer_email: string | null;
    amount_cad: number | null;
    line_items: unknown;
  }
): Promise<void> {
  const lineJson = JSON.stringify(params.line_items ?? []);
  await client.query(
    `INSERT INTO orders (stripe_session_id, stripe_payment_intent, customer_email, amount_cad, status, line_items, updated_at)
     VALUES ($1, $2, $3, $4, 'paid', $5::jsonb, NOW())
     ON CONFLICT (stripe_session_id) DO UPDATE SET
       stripe_payment_intent = COALESCE(EXCLUDED.stripe_payment_intent, orders.stripe_payment_intent),
       customer_email = COALESCE(EXCLUDED.customer_email, orders.customer_email),
       amount_cad = COALESCE(EXCLUDED.amount_cad, orders.amount_cad),
       line_items = COALESCE(EXCLUDED.line_items, orders.line_items),
       status = 'paid',
       updated_at = NOW()`,
    [
      params.stripe_session_id,
      params.stripe_payment_intent,
      params.customer_email,
      params.amount_cad,
      lineJson,
    ]
  );
}

export async function listOrdersAdmin(client: Pool | PoolClient): Promise<OrderRow[]> {
  const r = await client.query<OrderRow>(
    `SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`
  );
  return r.rows;
}

/** Reinforce paid status when Stripe emits payment_intent.succeeded (after or alongside checkout.session.completed). */
export async function markOrderPaidByPaymentIntent(
  client: Pool | PoolClient,
  params: { stripe_payment_intent: string; amount_cad: number | null }
): Promise<void> {
  await client.query(
    `UPDATE orders SET
       status = 'paid',
       amount_cad = COALESCE(amount_cad, $2),
       updated_at = NOW()
     WHERE stripe_payment_intent = $1`,
    [params.stripe_payment_intent, params.amount_cad]
  );
}

export async function insertNegotiationMessage(
  client: Pool | PoolClient,
  row: {
    negotiation_id: number;
    direction: "in" | "out";
    body: string;
    provider_id?: string | null;
    template_key?: string | null;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO negotiation_messages (negotiation_id, direction, body, provider_id, template_key)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      row.negotiation_id,
      row.direction,
      row.body,
      row.provider_id ?? null,
      row.template_key ?? null,
    ]
  );
}

/**
 * Insert inbound SMS/MMS. Returns false if provider_id already exists (retry Telnyx).
 */
export async function insertInboundNegotiationMessage(
  client: Pool | PoolClient,
  row: {
    negotiation_id: number;
    body: string;
    provider_id: string | null;
  }
): Promise<boolean> {
  const pid = row.provider_id?.trim() || null;
  if (!pid) {
    await insertNegotiationMessage(client, {
      negotiation_id: row.negotiation_id,
      direction: "in",
      body: row.body,
      provider_id: null,
    });
    return true;
  }
  const r = await client.query<{ id: string }>(
    `INSERT INTO negotiation_messages (negotiation_id, direction, body, provider_id, template_key)
     VALUES ($1, 'in', $2, $3, NULL)
     ON CONFLICT (provider_id) WHERE (provider_id IS NOT NULL) DO NOTHING
     RETURNING id`,
    [row.negotiation_id, row.body, pid]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function findNegotiationIdBySellerPhone(
  client: Pool | PoolClient,
  phoneE164: string
): Promise<number | null> {
  const r = await client.query<{ id: number }>(
    `WITH ranked AS (
       SELECT id, last_action_at, trim(seller_phone) AS sp,
         CASE
           WHEN length(regexp_replace(COALESCE(seller_phone, ''), '[^0-9]', '', 'g')) = 10 THEN
             '+1' || regexp_replace(COALESCE(seller_phone, ''), '[^0-9]', '', 'g')
           WHEN length(regexp_replace(COALESCE(seller_phone, ''), '[^0-9]', '', 'g')) = 11
             AND left(regexp_replace(COALESCE(seller_phone, ''), '[^0-9]', '', 'g'), 1) = '1' THEN
             '+' || regexp_replace(COALESCE(seller_phone, ''), '[^0-9]', '', 'g')
           WHEN trim(COALESCE(seller_phone, '')) LIKE '+%'
             AND length(regexp_replace(COALESCE(seller_phone, ''), '[^0-9]', '', 'g')) >= 10 THEN
             '+' || regexp_replace(COALESCE(seller_phone, ''), '[^0-9]', '', 'g')
           ELSE NULL
         END AS norm_phone
       FROM negotiations
       WHERE seller_phone IS NOT NULL AND trim(seller_phone) <> ''
     )
     SELECT id FROM ranked
     WHERE norm_phone = $1 OR sp = $1
     ORDER BY last_action_at DESC
     LIMIT 1`,
    [phoneE164]
  );
  return r.rows[0]?.id ?? null;
}
</think>


<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Read

export async function getNegotiation(
  client: Pool | PoolClient,
  id: number
): Promise<NegotiationRow | null> {
  const r = await client.query<NegotiationRow>(`SELECT * FROM negotiations WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function appendNegotiationNote(
  client: Pool | PoolClient,
  id: number,
  line: string
): Promise<void> {
  const row = await getNegotiation(client, id);
  if (!row) return;
  const next = row.notes ? `${row.notes}\n${line}` : line;
  await client.query(`UPDATE negotiations SET notes = $1, last_action_at = NOW() WHERE id = $2`, [
    next,
    id,
  ]);
}

export async function listRecentNegotiations(
  client: Pool | PoolClient,
  limit: number
): Promise<NegotiationRow[]> {
  const r = await client.query<NegotiationRow>(
    `SELECT * FROM negotiations ORDER BY last_action_at DESC LIMIT $1`,
    [limit]
  );
  return r.rows;
}

export type DashboardStats = {
  orders_7d: number;
  orders_7d_total_cad: string;
  active_negotiations: number;
  inbound_awaiting_reply: number;
};

export async function getDashboardStats(client: Pool | PoolClient): Promise<DashboardStats> {
  const o = await client.query<{ c: string; s: string }>(
    `SELECT count(*)::text AS c, coalesce(sum(amount_cad), 0)::text AS s
     FROM orders
     WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 'paid'`
  );
  const n = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM negotiations WHERE stage NOT IN ('won', 'lost')`
  );
  const p = await client.query<{ c: string }>(
    `WITH last_msg AS (
       SELECT DISTINCT ON (negotiation_id) negotiation_id, direction
       FROM negotiation_messages
       ORDER BY negotiation_id, created_at DESC
     )
     SELECT count(*)::text AS c FROM last_msg WHERE direction = 'in'`
  );
  return {
    orders_7d: Number(o.rows[0]?.c ?? 0),
    orders_7d_total_cad: o.rows[0]?.s ?? "0",
    active_negotiations: Number(n.rows[0]?.c ?? 0),
    inbound_awaiting_reply: Number(p.rows[0]?.c ?? 0),
  };
}

export async function insertAuditLog(
  client: Pool | PoolClient,
  row: { actor?: string; action: string; detail?: unknown }
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (actor, action, detail) VALUES ($1, $2, $3::jsonb)`,
    [row.actor ?? "telegram", row.action, JSON.stringify(row.detail ?? {})]
  );
}

