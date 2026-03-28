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
