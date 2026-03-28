-- Q-CFA: listings + price history + one-time deal SMS dedupe

CREATE TABLE IF NOT EXISTS listings (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  listing_url TEXT NOT NULL UNIQUE,
  title TEXT,
  year INTEGER,
  mileage_km INTEGER,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deal_notify_sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  price_cad NUMERIC,
  title TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_last_seen ON listings (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_snapshots_listing ON price_snapshots (listing_id, scraped_at DESC);

-- --- Site public, admin, inventaire, négociations ---

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_videos (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  video_url TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merch_products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_cad NUMERIC(12, 2),
  image_url TEXT,
  external_url TEXT,
  stripe_price_id TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('vehicle', 'machine', 'other')),
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  details TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'available', 'reserved', 'sold')),
  image_urls TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS negotiations (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'kijiji',
  listing_url TEXT,
  title TEXT,
  seller_phone TEXT,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'negotiating', 'won', 'lost')),
  notes TEXT DEFAULT '',
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_videos_published ON site_videos (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_merch_published ON merch_products (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items (status, sort_order);

-- Stripe merch (idempotent for existing DBs)
ALTER TABLE merch_products ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  customer_email TEXT,
  amount_cad NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'cad',
  status TEXT NOT NULL DEFAULT 'pending',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS negotiation_messages (
  id BIGSERIAL PRIMARY KEY,
  negotiation_id INTEGER NOT NULL REFERENCES negotiations (id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  body TEXT NOT NULL,
  provider_id TEXT,
  template_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nego_msgs_nego ON negotiation_messages (negotiation_id, created_at DESC);

-- Idempotence retries Telnyx (même message.id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nego_msgs_provider_unique
  ON negotiation_messages (provider_id)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_negotiations_seller_phone ON negotiations (seller_phone);

CREATE TABLE IF NOT EXISTS vehicle_projects (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_project_media (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES vehicle_projects (id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vpm_project ON vehicle_project_media (project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_vehicle_projects_pub ON vehicle_projects (published, sort_order);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL DEFAULT 'telegram',
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);
