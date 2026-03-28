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
    sort_order?: number;
    published?: boolean;
  }
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO merch_products (name, description, price_cad, image_url, external_url, sort_order, published)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      body.name,
      body.description ?? "",
      body.price_cad ?? null,
      body.image_url ?? null,
      body.external_url ?? null,
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
