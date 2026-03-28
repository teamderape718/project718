import React, { useEffect, useMemo, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api, getToken, setToken } from "./api";
import { LogoMark } from "./LogoMark";
import { HomeLanding } from "./components/HomeLanding";
import { SiteFooter } from "./components/SiteFooter";

/** Email du compte administrateur (prérempli sur la page de connexion). */
const ADMIN_LOGIN_EMAIL = "teamderape.718@yahoo.com";

type Video = {
  id: number;
  title: string;
  video_url: string;
  description: string;
  thumbnail_url: string | null;
  sort_order: number;
  published: boolean;
};

type Merch = {
  id: number;
  name: string;
  description: string;
  price_cad: string | null;
  image_url: string | null;
  external_url: string | null;
  stripe_price_id?: string | null;
  published: boolean;
};

type Inv = {
  id: number;
  category: string;
  title: string;
  subtitle: string;
  details: string;
  status: string;
  image_urls: string[];
};

type NegotiationAdmin = {
  id: number;
  source: string;
  listing_url: string | null;
  title: string | null;
  seller_phone: string | null;
  stage: string;
  notes: string;
  last_action_at: string;
  created_at: string;
  message_count: number;
  last_message_body: string | null;
  last_message_direction: string | null;
  last_message_at: string | null;
};

type NegotiationMessage = {
  id: string;
  negotiation_id: number;
  direction: string;
  body: string;
  provider_id: string | null;
  template_key: string | null;
  created_at: string;
};

type PipelineStats = {
  orders_last_7d: number;
  active_deals: number;
  pending_sms_reply: number;
};

const NEGO_STAGES = ["new", "contacted", "negotiating", "won", "lost"] as const;

const NEGO_STAGE_LABEL: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  negotiating: "En cours",
  won: "Gagné",
  lost: "Perdu",
};

const SMS_TPL_OPTIONS = [
  { value: "contact", label: "Premier contact" },
  { value: "followup", label: "Relance" },
  { value: "slots", label: "Proposition de créneaux" },
  { value: "confirm_rdv", label: "Confirmation RDV" },
] as const;

type VehicleProjectPublic = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  sort_order: number;
  published: boolean;
  cover_url: string | null;
};

type VehicleProjectMedia = {
  id: number;
  project_id: number;
  media_type: string;
  url: string;
  caption: string;
  sort_order: number;
};

type VehicleProjectDetail = Omit<VehicleProjectPublic, "cover_url"> & {
  media: VehicleProjectMedia[];
  created_at: string;
  updated_at: string;
};

type VehicleProjectAdmin = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  sort_order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  media: VehicleProjectMedia[];
};

type Order = {
  id: number;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  customer_email: string | null;
  amount_cad: string | null;
  currency: string;
  status: string;
  line_items: unknown;
  created_at: string;
  updated_at: string;
};

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-root">
      <div className="announce-bar">
        <span className="announce-bar-marquee">
          <span>Nouveautés &amp; drops — TEAM DÉRAPE 718</span>
          <span aria-hidden> · </span>
          <span>Québec · vitrine officielle</span>
          <span aria-hidden> · </span>
          <span>Shop le merch · vidéos · univers</span>
        </span>
      </div>
      <header className="site-header">
        <div className="layout site-header-inner">
          <nav className="top">
            <NavLink to="/" className="nav-brand">
              <LogoMark height={48} className="nav-logo" />
              <span className="nav-brand-text">
                <span className="sub">Official store</span>
                <span className="main">TEAM DÉRAPE 718</span>
              </span>
            </NavLink>
            <div className="nav-links">
              <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/">
                Accueil
              </NavLink>
              <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/videos">
                Vidéos
              </NavLink>
              <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/merch">
                Boutique
              </NavLink>
              <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/inventaire">
                Univers
              </NavLink>
              <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/projets">
                Projets
              </NavLink>
              <span className="nav-cta">
                <NavLink to="/connexion">Connexion</NavLink>
              </span>
            </div>
          </nav>
        </div>
      </header>
      <main className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}

function VideosPage() {
  const [rows, setRows] = useState<Video[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Video[]>("/api/public/videos")
      .then(setRows)
      .catch((e) => setErr(String(e.message)));
  }, []);
  if (err) return <p className="muted layout page-inner">{err}</p>;
  return (
    <div className="layout page-inner">
      <h1 className="page-title">Vidéos</h1>
      <div className="card-grid">
        {rows.map((v) => (
          <div key={v.id} className="card">
            <h3>{v.title}</h3>
            <p className="muted">{v.description}</p>
            <a href={v.video_url} target="_blank" rel="noreferrer">
              Regarder
            </a>
          </div>
        ))}
        {!rows.length && <p className="muted">Aucune vidéo publiée pour le moment.</p>}
      </div>
    </div>
  );
}

function MerchPage() {
  const [rows, setRows] = useState<Merch[]>([]);
  const [err, setErr] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);
  const checkoutFlag = searchParams.get("checkout");

  useEffect(() => {
    api<Merch[]>("/api/public/merch")
      .then(setRows)
      .catch((e) => setErr(String(e.message)));
  }, []);

  useEffect(() => {
    if (checkoutFlag !== "success" && checkoutFlag !== "cancel") return;
    const t = window.setTimeout(() => {
      setSearchParams({}, { replace: true });
    }, 8000);
    return () => window.clearTimeout(t);
  }, [checkoutFlag, setSearchParams]);

  async function startCheckout(merchId: number) {
    setErr("");
    setCheckoutLoading(merchId);
    try {
      const { url } = await api<{ url: string }>("/api/public/checkout", {
        method: "POST",
        body: JSON.stringify({ merch_id: merchId, quantity: 1 }),
        token: false,
      });
      window.location.href = url;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Impossible de démarrer le paiement");
      setCheckoutLoading(null);
    }
  }

  if (err && !rows.length) return <p className="muted layout page-inner">{err}</p>;
  return (
    <div className="layout page-inner">
      <h1 className="page-title">Boutique</h1>
      {checkoutFlag === "success" && (
        <p className="card" style={{ marginBottom: "1rem", borderColor: "rgba(163, 230, 53, 0.35)" }} role="status">
          Paiement réussi — merci pour ta commande.
        </p>
      )}
      {checkoutFlag === "cancel" && (
        <p className="muted" style={{ marginBottom: "1rem" }} role="status">
          Paiement annulé. Tu peux réessayer quand tu veux.
        </p>
      )}
      {err && rows.length > 0 && (
        <p style={{ color: "#f87171", marginBottom: "1rem" }} role="alert">
          {err}
        </p>
      )}
      <div className="card-grid two">
        {rows.map((m) => (
          <div key={m.id} className="card">
            {m.image_url && (
              <img
                src={m.image_url}
                alt=""
                style={{ width: "100%", borderRadius: 8, marginBottom: "0.75rem" }}
              />
            )}
            <h3>{m.name}</h3>
            <p className="muted">{m.description}</p>
            {m.price_cad != null && <p>{m.price_cad} $</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem" }}>
              {m.stripe_price_id != null && String(m.stripe_price_id).trim() !== "" && (
                <button
                  type="button"
                  className="btn"
                  disabled={checkoutLoading === m.id}
                  onClick={() => void startCheckout(m.id)}
                >
                  {checkoutLoading === m.id ? "Redirection…" : "Acheter en ligne (Stripe)"}
                </button>
              )}
              {m.external_url && (
                <a className="btn secondary" href={m.external_url} target="_blank" rel="noreferrer">
                  Lien externe
                </a>
              )}
            </div>
          </div>
        ))}
        {!rows.length && <p className="muted">Aucun produit pour le moment.</p>}
      </div>
    </div>
  );
}

function InventoryPage() {
  const [rows, setRows] = useState<Inv[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<Inv[]>("/api/public/inventory")
      .then(setRows)
      .catch((e) => setErr(String(e.message)));
  }, []);
  if (err) return <p className="muted layout page-inner">{err}</p>;
  return (
    <div className="layout page-inner">
      <h1 className="page-title">Univers</h1>
      <div className="card-grid">
        {rows.map((i) => (
          <div key={i.id} className="card">
            <span className="muted" style={{ textTransform: "uppercase", fontSize: "0.75rem" }}>
              {i.category}
            </span>
            <h3>{i.title}</h3>
            {i.subtitle && <p className="muted">{i.subtitle}</p>}
            <p>{i.details}</p>
            <p className="muted">Statut : {i.status}</p>
          </div>
        ))}
        {!rows.length && <p className="muted">Rien en vitrine pour le moment.</p>}
      </div>
    </div>
  );
}

function VehicleProjectsPage() {
  const [rows, setRows] = useState<VehicleProjectPublic[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<VehicleProjectPublic[]>("/api/public/vehicle-projects")
      .then(setRows)
      .catch((e) => setErr(String(e.message)));
  }, []);
  if (err) return <p className="muted layout page-inner">{err}</p>;
  return (
    <div className="layout page-inner">
      <h1 className="page-title">Projets véhicules</h1>
      <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "1.5rem", maxWidth: "40rem" }}>
        Albums build : photos et vidéos des machines qu’on suit — même ligne graphique que l’accueil.
      </p>
      <div className="card-grid two">
        {rows.map((p) => (
          <NavLink key={p.id} to={`/projets/${p.slug}`} className="card vp-card-link">
            <div className="vp-card-media">
              {p.cover_url ? (
                <img src={p.cover_url} alt="" loading="lazy" />
              ) : (
                <div className="vp-card-placeholder">718</div>
              )}
            </div>
            <h3>{p.title}</h3>
            {p.summary && <p className="muted">{p.summary}</p>}
            <span className="vp-card-more">Voir le projet →</span>
          </NavLink>
        ))}
        {!rows.length && <p className="muted">Aucun projet publié pour le moment.</p>}
      </div>
    </div>
  );
}

function videoEmbedFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      }
      const short = u.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (short?.[1]) return `https://www.youtube-nocookie.com/embed/${short[1]}`;
      const embed = u.pathname.match(/^\/embed\/([^/?#]+)/);
      if (embed?.[1]) return `https://www.youtube-nocookie.com/embed/${embed[1]}`;
    }
    if (host === "vimeo.com") {
      const m = u.pathname.match(/^\/(\d+)/);
      if (m?.[1]) return `https://player.vimeo.com/video/${m[1]}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function VehicleProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [row, setRow] = useState<VehicleProjectDetail | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!slug) return;
    setErr("");
    api<VehicleProjectDetail>(`/api/public/vehicle-projects/${encodeURIComponent(slug)}`)
      .then(setRow)
      .catch((e) => setErr(String(e.message)));
  }, [slug]);
  if (err) {
    return (
      <div className="layout page-inner">
        <p className="muted">{err}</p>
        <NavLink to="/projets">← Retour aux projets</NavLink>
      </div>
    );
  }
  if (!row) return <p className="muted layout page-inner">Chargement…</p>;
  return (
    <div className="layout page-inner vp-detail">
      <NavLink to="/projets" className="muted vp-back">
        ← Projets
      </NavLink>
      <h1 className="page-title">{row.title}</h1>
      {row.summary && <p className="vp-detail-summary">{row.summary}</p>}
      <div className="vp-media-grid">
        {row.media.map((m) => (
          <figure key={m.id} className="vp-media-item">
            {m.media_type === "image" ? (
              <img src={m.url} alt={m.caption || ""} loading="lazy" />
            ) : (
              (() => {
                const embed = videoEmbedFromUrl(m.url);
                return embed ? (
                  <div className="vp-video-embed">
                    <iframe
                      title={m.caption || "Vidéo"}
                      src={embed}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="vp-video-wrap">
                    <a href={m.url} target="_blank" rel="noreferrer" className="ld-btn ld-btn--outline ld-btn--sm">
                      Voir la vidéo
                    </a>
                  </div>
                );
              })()
            )}
            {m.caption && <figcaption className="muted">{m.caption}</figcaption>}
          </figure>
        ))}
        {!row.media.length && <p className="muted">Médias à venir.</p>}
      </div>
    </div>
  );
}

function ConnexionPage() {
  const [email, setEmail] = useState(ADMIN_LOGIN_EMAIL);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const r = await api<{ token: string }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        token: false,
      });
      setToken(r.token);
      nav("/admin/panel");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="layout page-inner page-inner--auth">
      <div className="login-card">
        <div className="logo-wrap">
          <LogoMark height={72} />
        </div>
      <h1>Connexion</h1>
      <p className="muted" style={{ marginTop: "-0.25rem", marginBottom: "1.25rem" }}>
        Accès réservé — gestion du contenu et de la vitrine.
      </p>
      <form onSubmit={submit}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="username" />
        <label>Mot de passe</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          autoComplete="current-password"
        />
        {err && <p style={{ color: "#f87171", marginBottom: "0.75rem" }}>{err}</p>}
        <button className="btn" type="submit" style={{ width: "100%" }}>
          Se connecter
        </button>
      </form>
      </div>
    </div>
  );
}

type AdminTab = "videos" | "merch" | "orders" | "inv" | "vproj" | "nego";

function adminTabFromQuery(param: string | null): AdminTab {
  switch (param) {
    case "orders":
      return "orders";
    case "negotiations":
    case "nego":
      return "nego";
    case "merch":
      return "merch";
    case "inventory":
    case "inv":
      return "inv";
    case "vehicle-projects":
    case "vproj":
    case "projects":
      return "vproj";
    case "videos":
      return "videos";
    default:
      return "videos";
  }
}

function queryParamForAdminTab(t: AdminTab): string {
  switch (t) {
    case "nego":
      return "negotiations";
    case "orders":
      return "orders";
    case "inv":
      return "inventory";
    case "vproj":
      return "vehicle-projects";
    case "merch":
      return "merch";
    case "videos":
      return "videos";
  }
}

function AdminPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<AdminTab>(() => adminTabFromQuery(searchParams.get("tab")));
  const [videos, setVideos] = useState<Video[]>([]);
  const [merch, setMerch] = useState<Merch[]>([]);
  const [inv, setInv] = useState<Inv[]>([]);
  const [vproj, setVproj] = useState<VehicleProjectAdmin[]>([]);
  const [nego, setNego] = useState<NegotiationAdmin[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stripePaymentsBaseUrl, setStripePaymentsBaseUrl] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    setTab(adminTabFromQuery(searchParams.get("tab")));
  }, [searchParams]);

  const selectTab = (t: AdminTab) => {
    setTab(t);
    setSearchParams({ tab: queryParamForAdminTab(t) }, { replace: true });
  };

  useEffect(() => {
    if (!getToken()) return;
    const load = async () => {
      try {
        const [v, m, o, i, vp, n] = await Promise.all([
          api<Video[]>("/api/admin/videos"),
          api<Merch[]>("/api/admin/merch"),
          api<{ orders: Order[]; stripe_payments_base_url: string | null }>("/api/admin/orders"),
          api<Inv[]>("/api/admin/inventory"),
          api<VehicleProjectAdmin[]>("/api/admin/vehicle-projects"),
          api<NegotiationAdmin[]>("/api/admin/negotiations"),
        ]);
        setVideos(v);
        setMerch(m);
        setOrders(o.orders);
        setStripePaymentsBaseUrl(o.stripe_payments_base_url);
        setInv(i);
        setVproj(vp);
        setNego(n);
      } catch {
        setToken(null);
        nav("/connexion");
      }
    };
    load();
  }, [nav]);

  if (!getToken()) return <Navigate to="/connexion" replace />;

  return (
    <div className="layout page-inner">
      <h1>Administration</h1>
      <div className="admin-tabs">
        <button type="button" className={tab === "videos" ? "on" : ""} onClick={() => selectTab("videos")}>
          Vidéos
        </button>
        <button type="button" className={tab === "merch" ? "on" : ""} onClick={() => selectTab("merch")}>
          Merch
        </button>
        <button type="button" className={tab === "orders" ? "on" : ""} onClick={() => selectTab("orders")}>
          Commandes
        </button>
        <button type="button" className={tab === "inv" ? "on" : ""} onClick={() => selectTab("inv")}>
          Inventaire
        </button>
        <button type="button" className={tab === "vproj" ? "on" : ""} onClick={() => selectTab("vproj")}>
          Projets véhicules
        </button>
        <button type="button" className={tab === "nego" ? "on" : ""} onClick={() => selectTab("nego")}>
          Négociations
        </button>
        <button type="button" className="secondary btn" onClick={() => { setToken(null); nav("/connexion"); }}>
          Déconnexion
        </button>
      </div>

      {tab === "videos" && (
        <AdminVideosForm
          rows={videos}
          onRefresh={async () => setVideos(await api<Video[]>("/api/admin/videos"))}
        />
      )}
      {tab === "merch" && (
        <AdminMerchForm rows={merch} onRefresh={async () => setMerch(await api<Merch[]>("/api/admin/merch"))} />
      )}
      {tab === "orders" && (
        <AdminOrders
          rows={orders}
          stripePaymentsBaseUrl={stripePaymentsBaseUrl}
          onRefresh={async () => {
            const r = await api<{ orders: Order[]; stripe_payments_base_url: string | null }>(
              "/api/admin/orders"
            );
            setOrders(r.orders);
            setStripePaymentsBaseUrl(r.stripe_payments_base_url);
          }}
        />
      )}
      {tab === "inv" && (
        <AdminInvForm rows={inv} onRefresh={async () => setInv(await api<Inv[]>("/api/admin/inventory"))} />
      )}
      {tab === "vproj" && (
        <AdminVehicleProjectsForm
          rows={vproj}
          onRefresh={async () => setVproj(await api<VehicleProjectAdmin[]>("/api/admin/vehicle-projects"))}
        />
      )}
      {tab === "nego" && (
        <AdminNego
          rows={nego}
          onRefresh={async () => setNego(await api<NegotiationAdmin[]>("/api/admin/negotiations"))}
        />
      )}
    </div>
  );
}

function AdminVideosForm({ rows, onRefresh }: { rows: Video[]; onRefresh: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [video_url, setVideoUrl] = useState("");
  const [description, setDesc] = useState("");
  const [published, setPub] = useState(true);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/admin/videos", {
      method: "POST",
      body: JSON.stringify({ title, video_url, description, published }),
    });
    setTitle("");
    setVideoUrl("");
    setDesc("");
    await onRefresh();
  }

  async function togglePub(v: Video) {
    await api(`/api/admin/videos/${v.id}`, {
      method: "PATCH",
      body: JSON.stringify({ published: !v.published }),
    });
    await onRefresh();
  }

  async function del(id: number) {
    if (!confirm("Supprimer ?")) return;
    await api(`/api/admin/videos/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div>
      <h2>Ajouter une vidéo (URL YouTube / lien)</h2>
      <form onSubmit={add}>
        <label>Titre</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label>URL vidéo</label>
        <input value={video_url} onChange={(e) => setVideoUrl(e.target.value)} required />
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={3} />
        <label>
          <input type="checkbox" checked={published} onChange={(e) => setPub(e.target.checked)} /> Publié
        </label>
        <button className="btn" type="submit">
          Ajouter
        </button>
      </form>
      <h3 style={{ marginTop: "2rem" }}>Liste</h3>
      {rows.map((v) => (
        <div key={v.id} className="card" style={{ marginBottom: "0.75rem" }}>
          <strong>{v.title}</strong> {v.published ? "✓ publié" : "— brouillon"}
          <div style={{ marginTop: "0.5rem" }}>
            <button type="button" className="btn secondary" onClick={() => togglePub(v)}>
              Toggle publié
            </button>{" "}
            <button type="button" className="btn secondary" onClick={() => del(v.id)}>
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminMerchForm({ rows, onRefresh }: { rows: Merch[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDesc] = useState("");
  const [price_cad, setPrice] = useState("");
  const [image_url, setImg] = useState("");
  const [external_url, setExt] = useState("");
  const [stripe_price_id, setStripePriceId] = useState("");
  const [published, setPub] = useState(true);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/admin/merch", {
      method: "POST",
      body: JSON.stringify({
        name,
        description,
        price_cad: price_cad ? Number(price_cad) : null,
        image_url: image_url || null,
        external_url: external_url || null,
        stripe_price_id: stripe_price_id.trim() || null,
        published,
      }),
    });
    setName("");
    setDesc("");
    setPrice("");
    setImg("");
    setExt("");
    setStripePriceId("");
    await onRefresh();
  }

  async function del(id: number) {
    if (!confirm("Supprimer ?")) return;
    await api(`/api/admin/merch/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div>
      <h2>Nouveau produit merch</h2>
      <form onSubmit={add}>
        <label>Nom</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} />
        <label>Prix (CAD)</label>
        <input value={price_cad} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" />
        <label>Stripe Price ID (ex. price_…)</label>
        <input
          value={stripe_price_id}
          onChange={(e) => setStripePriceId(e.target.value)}
          placeholder="price_…"
          autoComplete="off"
        />
        <p className="muted" style={{ marginTop: "-0.25rem", marginBottom: "0.75rem", fontSize: "0.85rem" }}>
          Requis pour le bouton « Acheter en ligne » sur la boutique publique.
        </p>
        <label>URL image</label>
        <input value={image_url} onChange={(e) => setImg(e.target.value)} />
        <label>Lien externe (boutique)</label>
        <input value={external_url} onChange={(e) => setExt(e.target.value)} />
        <label>
          <input type="checkbox" checked={published} onChange={(e) => setPub(e.target.checked)} /> Publié
        </label>
        <button className="btn" type="submit">
          Ajouter
        </button>
      </form>
      <h3 style={{ marginTop: "2rem" }}>Liste</h3>
      {rows.map((m) => (
        <AdminMerchRow key={m.id} m={m} onDelete={del} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function AdminMerchRow({
  m,
  onDelete,
  onRefresh,
}: {
  m: Merch;
  onDelete: (id: number) => void;
  onRefresh: () => Promise<void>;
}) {
  const [stripeDraft, setStripeDraft] = useState(m.stripe_price_id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStripeDraft(m.stripe_price_id ?? "");
  }, [m.id, m.stripe_price_id]);

  async function saveStripe() {
    setSaving(true);
    try {
      await api(`/api/admin/merch/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stripe_price_id: stripeDraft.trim() || null }),
      });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: "0.75rem" }}>
      <strong>{m.name}</strong> — {m.published ? "publié" : "brouillon"}
      <div style={{ marginTop: "0.5rem" }}>
        <label style={{ display: "block", fontSize: "0.85rem" }}>Stripe Price ID</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <input
            value={stripeDraft}
            onChange={(e) => setStripeDraft(e.target.value)}
            placeholder="price_…"
            style={{ flex: "1 1 12rem", minWidth: "8rem" }}
            autoComplete="off"
          />
          <button type="button" className="btn secondary" disabled={saving} onClick={() => void saveStripe()}>
            {saving ? "…" : "Enregistrer"}
          </button>
          <button type="button" className="btn secondary" onClick={() => onDelete(m.id)}>
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminInvForm({ rows, onRefresh }: { rows: Inv[]; onRefresh: () => Promise<void> }) {
  const [category, setCat] = useState("vehicle");
  const [title, setTitle] = useState("");
  const [subtitle, setSub] = useState("");
  const [details, setDet] = useState("");
  const [status, setSt] = useState("draft");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/admin/inventory", {
      method: "POST",
      body: JSON.stringify({ category, title, subtitle, details, status, image_urls: [] }),
    });
    setTitle("");
    setSub("");
    setDet("");
    await onRefresh();
  }

  async function patchStatus(id: number, status: string) {
    await api(`/api/admin/inventory/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await onRefresh();
  }

  async function del(id: number) {
    if (!confirm("Supprimer ?")) return;
    await api(`/api/admin/inventory/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div>
      <h2>Nouvel item inventaire</h2>
      <form onSubmit={add}>
        <label>Catégorie</label>
        <select value={category} onChange={(e) => setCat(e.target.value)}>
          <option value="vehicle">Véhicule</option>
          <option value="machine">Machine</option>
          <option value="other">Autre</option>
        </select>
        <label>Titre</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label>Sous-titre</label>
        <input value={subtitle} onChange={(e) => setSub(e.target.value)} />
        <label>Détails</label>
        <textarea value={details} onChange={(e) => setDet(e.target.value)} rows={4} />
        <label>Statut</label>
        <select value={status} onChange={(e) => setSt(e.target.value)}>
          <option value="draft">Brouillon</option>
          <option value="available">Disponible</option>
          <option value="reserved">Réservé</option>
          <option value="sold">Vendu</option>
        </select>
        <button className="btn" type="submit">
          Ajouter
        </button>
      </form>
      <h3 style={{ marginTop: "2rem" }}>Liste</h3>
      {rows.map((i) => (
        <div key={i.id} className="card" style={{ marginBottom: "0.75rem" }}>
          <strong>{i.title}</strong> ({i.category}) — {i.status}
          <div style={{ marginTop: "0.5rem" }}>
            <select
              value={i.status}
              onChange={(e) => patchStatus(i.id, e.target.value)}
              style={{ width: "auto", display: "inline-block" }}
            >
              <option value="draft">brouillon</option>
              <option value="available">disponible</option>
              <option value="reserved">réservé</option>
              <option value="sold">vendu</option>
            </select>{" "}
            <button type="button" className="btn secondary" onClick={() => del(i.id)}>
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminVehicleProjectsForm({
  rows,
  onRefresh,
}: {
  rows: VehicleProjectAdmin[];
  onRefresh: () => Promise<void>;
}) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sort_order, setSortOrder] = useState("0");
  const [published, setPub] = useState(false);
  const [mediaProjectId, setMediaProjectId] = useState<number | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editSort, setEditSort] = useState("0");

  function startEdit(p: VehicleProjectAdmin) {
    setEditingId(p.id);
    setEditSlug(p.slug);
    setEditTitle(p.title);
    setEditSummary(p.summary);
    setEditSort(String(p.sort_order));
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId == null) return;
    await api(`/api/admin/vehicle-projects/${editingId}`, {
      method: "PATCH",
      body: JSON.stringify({
        slug: editSlug.trim().toLowerCase(),
        title: editTitle.trim(),
        summary: editSummary.trim(),
        sort_order: editSort ? Number(editSort) : 0,
      }),
    });
    setEditingId(null);
    await onRefresh();
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/admin/vehicle-projects", {
      method: "POST",
      body: JSON.stringify({
        slug: slug.trim().toLowerCase(),
        title: title.trim(),
        summary: summary.trim(),
        sort_order: sort_order ? Number(sort_order) : 0,
        published,
      }),
    });
    setSlug("");
    setTitle("");
    setSummary("");
    setSortOrder("0");
    setPub(false);
    await onRefresh();
  }

  async function togglePub(p: VehicleProjectAdmin) {
    await api(`/api/admin/vehicle-projects/${p.id}`, {
      method: "PATCH",
      body: JSON.stringify({ published: !p.published }),
    });
    await onRefresh();
  }

  async function delProject(id: number) {
    if (!confirm("Supprimer ce projet et tous ses médias ?")) return;
    await api(`/api/admin/vehicle-projects/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  async function addMedia(e: React.FormEvent) {
    e.preventDefault();
    if (mediaProjectId == null) return;
    await api(`/api/admin/vehicle-projects/${mediaProjectId}/media`, {
      method: "POST",
      body: JSON.stringify({
        media_type: mediaType,
        url: mediaUrl.trim(),
        caption: mediaCaption.trim(),
      }),
    });
    setMediaUrl("");
    setMediaCaption("");
    await onRefresh();
  }

  async function delMedia(id: number) {
    if (!confirm("Supprimer ce média ?")) return;
    await api(`/api/admin/vehicle-project-media/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div>
      <h2>Nouveau projet véhicule</h2>
      <p className="muted" style={{ marginBottom: "1rem", maxWidth: "36rem" }}>
        Slug : URL publique <code>/projets/&lt;slug&gt;</code> — minuscules, chiffres et tirets uniquement (ex.{" "}
        <code>bmw-e36-drift</code>).
      </p>
      <form onSubmit={addProject}>
        <label>Slug</label>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="ex. e36-track" />
        <label>Titre</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label>Résumé</label>
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
        <label>Ordre d’affichage</label>
        <input
          value={sort_order}
          onChange={(e) => setSortOrder(e.target.value)}
          type="number"
          style={{ maxWidth: "8rem" }}
        />
        <label>
          <input type="checkbox" checked={published} onChange={(e) => setPub(e.target.checked)} /> Publié (visible sur le site)
        </label>
        <button className="btn" type="submit">
          Créer le projet
        </button>
      </form>

      <h3 style={{ marginTop: "2rem" }}>Projets</h3>
      {rows.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: "1rem" }}>
          {editingId === p.id ? (
            <form onSubmit={saveEdit}>
              <h4 style={{ marginTop: 0, fontSize: "0.95rem" }}>Modifier le projet</h4>
              <label>Slug</label>
              <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} required />
              <label>Titre</label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              <label>Résumé</label>
              <textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)} rows={3} />
              <label>Ordre</label>
              <input
                value={editSort}
                onChange={(e) => setEditSort(e.target.value)}
                type="number"
                style={{ maxWidth: "8rem" }}
              />
              <div style={{ marginTop: "0.5rem" }}>
                <button className="btn" type="submit">
                  Enregistrer
                </button>{" "}
                <button type="button" className="btn secondary" onClick={() => setEditingId(null)}>
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                <strong>{p.title}</strong>
                <span className="muted">
                  /projets/{p.slug} — {p.published ? "publié" : "brouillon"}
                </span>
              </div>
              {p.summary && <p className="muted" style={{ marginTop: "0.35rem" }}>{p.summary}</p>}
              <div style={{ marginTop: "0.5rem" }}>
                <button type="button" className="btn secondary" onClick={() => startEdit(p)}>
                  Modifier
                </button>{" "}
                <button type="button" className="btn secondary" onClick={() => togglePub(p)}>
                  Toggle publié
                </button>{" "}
                <button type="button" className="btn secondary" onClick={() => delProject(p.id)}>
                  Supprimer projet
                </button>
              </div>
            </>
          )}
          <h4 style={{ marginTop: "1rem", fontSize: "0.95rem" }}>Médias</h4>
          <ul style={{ margin: "0.25rem 0 0.5rem", paddingLeft: "1.25rem" }}>
            {p.media.map((m) => (
              <li key={m.id}>
                <span className="muted">{m.media_type}</span> — {m.url.slice(0, 60)}
                {m.url.length > 60 ? "…" : ""}
                <button
                  type="button"
                  className="btn secondary"
                  style={{ marginLeft: "0.35rem", padding: "0.15rem 0.5rem", fontSize: "0.8rem" }}
                  onClick={() => delMedia(m.id)}
                >
                  ×
                </button>
              </li>
            ))}
            {!p.media.length && <li className="muted">Aucun média</li>}
          </ul>
          {mediaProjectId === p.id ? (
            <form onSubmit={addMedia} style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
              <label>Type</label>
              <select value={mediaType} onChange={(e) => setMediaType(e.target.value as "image" | "video")}>
                <option value="image">Image</option>
                <option value="video">Vidéo (URL)</option>
              </select>
              <label>URL</label>
              <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} required />
              <label>Légende</label>
              <input value={mediaCaption} onChange={(e) => setMediaCaption(e.target.value)} />
              <button className="btn" type="submit">
                Ajouter le média
              </button>{" "}
              <button type="button" className="btn secondary" onClick={() => setMediaProjectId(null)}>
                Annuler
              </button>
            </form>
          ) : (
            <button type="button" className="btn secondary" onClick={() => setMediaProjectId(p.id)}>
              Ajouter un média
            </button>
          )}
        </div>
      ))}
      {!rows.length && <p className="muted">Aucun projet.</p>}
    </div>
  );
}

function AdminOrders({
  rows,
  stripePaymentsBaseUrl,
  onRefresh,
}: {
  rows: Order[];
  stripePaymentsBaseUrl: string | null;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div>
      <h2>Commandes (Stripe)</h2>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Payées via Checkout ; les notifications Telegram pointent ici. Ouvre le paiement dans le{" "}
        <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
          tableau de bord Stripe
        </a>{" "}
        (test ou live selon ta clé secrète).
      </p>
      <button type="button" className="btn secondary" style={{ marginBottom: "1rem" }} onClick={() => onRefresh()}>
        Actualiser
      </button>
      {rows.map((o) => (
        <div key={o.id} className="card" style={{ marginBottom: "0.75rem" }}>
          <strong>#{o.id}</strong> · {o.status}
          <p>Client : {o.customer_email ?? "—"}</p>
          <p>
            Montant : {o.amount_cad != null ? `${o.amount_cad} ${o.currency || "CAD"}` : "—"}
          </p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Session : {o.stripe_session_id ?? "—"}
          </p>
          {o.stripe_payment_intent && stripePaymentsBaseUrl && (
            <p style={{ marginTop: "0.35rem" }}>
              <a
                href={`${stripePaymentsBaseUrl}/${encodeURIComponent(o.stripe_payment_intent)}`}
                target="_blank"
                rel="noreferrer"
              >
                Voir le paiement dans Stripe →
              </a>
            </p>
          )}
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Créée : {o.created_at}
          </p>
          {o.line_items != null && (
            <pre
              style={{
                marginTop: "0.5rem",
                fontSize: "0.75rem",
                overflow: "auto",
                maxHeight: "8rem",
                background: "rgba(0,0,0,0.2)",
                padding: "0.5rem",
                borderRadius: "4px",
              }}
            >
              {typeof o.line_items === "string" ? o.line_items : JSON.stringify(o.line_items, null, 2)}
            </pre>
          )}
        </div>
      ))}
      {!rows.length && <p className="muted">Aucune commande enregistrée.</p>}
    </div>
  );
}

function formatNegoDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-CA", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function negoNeedsReply(n: NegotiationAdmin): boolean {
  if (n.stage === "won" || n.stage === "lost") return false;
  return n.last_message_direction === "in";
}

function AdminNego({ rows, onRefresh }: { rows: NegotiationAdmin[]; onRefresh: () => Promise<void> }) {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [messages, setMessages] = useState<NegotiationMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [smsTpl, setSmsTpl] = useState<(typeof SMS_TPL_OPTIONS)[number]["value"]>("contact");
  const [smsSlots, setSmsSlots] = useState("");
  const [smsWhen, setSmsWhen] = useState("");
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsErr, setSmsErr] = useState<string | null>(null);

  async function loadStats() {
    try {
      const s = await api<PipelineStats>("/api/admin/negotiations/stats");
      setStats(s);
    } catch {
      setStats(null);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  async function refreshAll() {
    await Promise.all([onRefresh(), loadStats()]);
  }

  async function patchStage(id: number, stage: string) {
    await api(`/api/admin/negotiations/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
    await refreshAll();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterStage !== "all" && r.stage !== filterStage) return false;
      if (!q) return true;
      const hay = [String(r.id), r.title ?? "", r.seller_phone ?? "", r.listing_url ?? "", r.source ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, filterStage]);

  const byStage = useMemo(() => {
    const m: Record<string, NegotiationAdmin[]> = {};
    for (const s of NEGO_STAGES) m[s] = [];
    const other: NegotiationAdmin[] = [];
    for (const r of filtered) {
      if (NEGO_STAGES.includes(r.stage as (typeof NEGO_STAGES)[number])) {
        m[r.stage]!.push(r);
      } else {
        other.push(r);
      }
    }
    return { m, other };
  }, [filtered]);

  const detailRow = detailId != null ? rows.find((r) => r.id === detailId) : undefined;

  useEffect(() => {
    if (detailRow) setNotesDraft(detailRow.notes ?? "");
  }, [detailId, detailRow?.notes]);

  useEffect(() => {
    setSmsErr(null);
    setSmsSlots("");
    setSmsWhen("");
    setSmsTpl("contact");
  }, [detailId]);

  useEffect(() => {
    if (detailId == null) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMsgsLoading(true);
    api<NegotiationMessage[]>(`/api/admin/negotiations/${detailId}/messages`)
      .then((data) => {
        if (!cancelled) setMessages(data);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setMsgsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  useEffect(() => {
    if (detailId == null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDetailId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);

  async function saveNotes() {
    if (detailId == null) return;
    setSavingNotes(true);
    try {
      await api(`/api/admin/negotiations/${detailId}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: notesDraft }),
      });
      await refreshAll();
    } finally {
      setSavingNotes(false);
    }
  }

  async function sendAdminTemplateSms() {
    if (detailId == null || !detailRow?.seller_phone) return;
    setSmsBusy(true);
    setSmsErr(null);
    try {
      const body: Record<string, string> = { template_key: smsTpl };
      if (smsTpl === "slots") body.slots_text = smsSlots.trim();
      if (smsTpl === "confirm_rdv") body.when_where = smsWhen.trim();
      await api(`/api/admin/negotiations/${detailId}/sms`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await api<NegotiationMessage[]>(`/api/admin/negotiations/${detailId}/messages`);
      setMessages(data);
      await refreshAll();
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : "Échec envoi SMS");
    } finally {
      setSmsBusy(false);
    }
  }

  function renderCard(n: NegotiationAdmin) {
    const reply = negoNeedsReply(n);
    return (
      <button
        key={n.id}
        type="button"
        className={`nego-kanban-card${reply ? " nego-kanban-card--reply" : ""}`}
        onClick={() => setDetailId(n.id)}
      >
        <span className="nego-kanban-card-id">#{n.id}</span>
        <span className="nego-kanban-card-title">{n.title?.trim() || "Sans titre"}</span>
        {n.seller_phone && <span className="muted nego-kanban-card-phone">{n.seller_phone}</span>}
        {reply && <span className="nego-badge-reply">Réponse à traiter</span>}
        {n.message_count > 0 && (
          <span className="muted nego-kanban-card-meta">{n.message_count} message(s)</span>
        )}
      </button>
    );
  }

  return (
    <div className="nego-pipeline">
      <div className="nego-pipeline-head">
        <div>
          <h2 style={{ marginBottom: "0.35rem" }}>Pipeline négociations</h2>
          <p className="muted" style={{ margin: 0, maxWidth: "40rem" }}>
            Vue Kanban ou tableau, filtre par étape, et fil d’historique SMS par deal.
          </p>
        </div>
        <div className="nego-pipeline-actions">
          <button type="button" className="btn secondary" onClick={() => void refreshAll()}>
            Actualiser
          </button>
        </div>
      </div>

      {stats && (
        <div className="nego-stats-row">
          <div className="nego-stat-card">
            <span className="nego-stat-value">{stats.orders_last_7d}</span>
            <span className="nego-stat-label">Commandes (7 j.)</span>
          </div>
          <div className="nego-stat-card">
            <span className="nego-stat-value">{stats.active_deals}</span>
            <span className="nego-stat-label">Deals actifs</span>
          </div>
          <div className="nego-stat-card nego-stat-card--alert">
            <span className="nego-stat-value">{stats.pending_sms_reply}</span>
            <span className="nego-stat-label">SMS entrants sans suite</span>
          </div>
        </div>
      )}

      <div className="nego-toolbar">
        <div className="nego-view-toggle">
          <button type="button" className={view === "kanban" ? "on" : ""} onClick={() => setView("kanban")}>
            Kanban
          </button>
          <button type="button" className={view === "table" ? "on" : ""} onClick={() => setView("table")}>
            Tableau
          </button>
        </div>
        <input
          type="search"
          className="nego-search"
          placeholder="Rechercher (id, titre, tél., URL…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filtrer les négociations"
        />
        <label className="nego-filter-label">
          <span className="muted">Étape</span>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
            <option value="all">Toutes</option>
            {NEGO_STAGES.map((s) => (
              <option key={s} value={s}>
                {NEGO_STAGE_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {view === "kanban" && (
        <div className="nego-kanban-scroll">
          <div className="nego-kanban-board">
            {NEGO_STAGES.map((stage) => (
              <div key={stage} className="nego-kanban-col">
                <h3 className="nego-kanban-col-title">
                  {NEGO_STAGE_LABEL[stage] ?? stage}
                  <span className="nego-kanban-count">{byStage.m[stage]?.length ?? 0}</span>
                </h3>
                <div className="nego-kanban-col-cards">{byStage.m[stage]?.map((n) => renderCard(n))}</div>
              </div>
            ))}
            {byStage.other.length > 0 && (
              <div className="nego-kanban-col">
                <h3 className="nego-kanban-col-title">
                  Autre
                  <span className="nego-kanban-count">{byStage.other.length}</span>
                </h3>
                <div className="nego-kanban-col-cards">{byStage.other.map((n) => renderCard(n))}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "table" && (
        <div className="nego-table-wrap">
          <table className="nego-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Titre</th>
                <th>Téléphone</th>
                <th>Étape</th>
                <th>Dernier échange</th>
                <th>Msgs</th>
                <th>Activité</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr key={n.id} className={negoNeedsReply(n) ? "nego-row-reply" : undefined}>
                  <td>{n.id}</td>
                  <td>
                    <strong>{n.title?.trim() || "—"}</strong>
                    {n.listing_url && (
                      <div>
                        <a href={n.listing_url} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: "0.8rem" }}>
                          Annonce
                        </a>
                      </div>
                    )}
                  </td>
                  <td>{n.seller_phone ?? "—"}</td>
                  <td>
                    <select
                      value={n.stage}
                      onChange={(e) => void patchStage(n.id, e.target.value)}
                      className="nego-table-select"
                      aria-label={`Étape pour #${n.id}`}
                    >
                      {!NEGO_STAGES.includes(n.stage as (typeof NEGO_STAGES)[number]) && (
                        <option value={n.stage}>{n.stage}</option>
                      )}
                      {NEGO_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {NEGO_STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {n.last_message_body ? (
                      <>
                        <span className={`nego-dir nego-dir--${n.last_message_direction === "in" ? "in" : "out"}`}>
                          {n.last_message_direction === "in" ? "↓" : "↑"}
                        </span>{" "}
                        <span className="nego-preview">{n.last_message_body.slice(0, 72)}{n.last_message_body.length > 72 ? "…" : ""}</span>
                        <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}>
                          {formatNegoDate(n.last_message_at)}
                        </div>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{n.message_count}</td>
                  <td className="muted" style={{ fontSize: "0.85rem" }}>
                    {formatNegoDate(n.last_action_at)}
                  </td>
                  <td>
                    <button type="button" className="btn secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.8rem" }} onClick={() => setDetailId(n.id)}>
                      Timeline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="muted nego-empty">Aucun résultat.</p>}
        </div>
      )}

      {!rows.length && <p className="muted">Aucune négociation enregistrée.</p>}

      {detailId != null && detailRow && (
        <div className="nego-drawer-backdrop" role="presentation" onClick={() => setDetailId(null)}>
          <aside
            className="nego-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nego-drawer-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="nego-drawer-head">
              <h3 id="nego-drawer-title">Deal #{detailRow.id}</h3>
              <button type="button" className="nego-drawer-close" aria-label="Fermer" onClick={() => setDetailId(null)}>
                ×
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              {detailRow.title?.trim() || "Sans titre"}
            </p>
            {detailRow.listing_url && (
              <p>
                <a href={detailRow.listing_url} target="_blank" rel="noreferrer">
                  Ouvrir l’annonce
                </a>
              </p>
            )}
            <p>
              <span className="muted">Tél.</span> {detailRow.seller_phone ?? "—"}
            </p>
            <label className="nego-drawer-field">
              <span className="muted">Étape</span>
              <select
                value={detailRow.stage}
                onChange={(e) => void patchStage(detailRow.id, e.target.value)}
              >
                {!NEGO_STAGES.includes(detailRow.stage as (typeof NEGO_STAGES)[number]) && (
                  <option value={detailRow.stage}>{detailRow.stage}</option>
                )}
                {NEGO_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {NEGO_STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>

            <h4 className="nego-timeline-title">Envoyer un SMS (modèle Telnyx)</h4>
            {!detailRow.seller_phone ? (
              <p className="muted" style={{ marginTop: 0 }}>
                Aucun numéro vendeur — ajoute-le sur la fiche ou via la source de la négociation.
              </p>
            ) : (
              <div className="nego-sms-form">
                <label className="nego-drawer-field">
                  <span className="muted">Modèle</span>
                  <select
                    value={smsTpl}
                    onChange={(e) => {
                      setSmsTpl(e.target.value as (typeof SMS_TPL_OPTIONS)[number]["value"]);
                      setSmsErr(null);
                    }}
                    aria-label="Modèle de SMS"
                  >
                    {SMS_TPL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {smsTpl === "slots" && (
                  <label className="nego-drawer-field">
                    <span className="muted">Créneaux proposés</span>
                    <textarea
                      className="nego-notes"
                      rows={2}
                      value={smsSlots}
                      onChange={(e) => setSmsSlots(e.target.value)}
                      placeholder="Ex. Lun 10h, Mar 15h, jeu. après-midi"
                    />
                  </label>
                )}
                {smsTpl === "confirm_rdv" && (
                  <label className="nego-drawer-field">
                    <span className="muted">Date, heure et lieu</span>
                    <textarea
                      className="nego-notes"
                      rows={2}
                      value={smsWhen}
                      onChange={(e) => setSmsWhen(e.target.value)}
                      placeholder="Ex. demain 14h, 123 rue Example, Montréal"
                    />
                  </label>
                )}
                {smsErr && (
                  <p className="nego-sms-err" role="alert">
                    {smsErr}
                  </p>
                )}
                <button
                  type="button"
                  className="btn secondary"
                  disabled={smsBusy}
                  onClick={() => void sendAdminTemplateSms()}
                >
                  {smsBusy ? "Envoi…" : "Envoyer le SMS"}
                </button>
              </div>
            )}

            <h4 className="nego-timeline-title">Fil SMS &amp; messages</h4>
            {msgsLoading && <p className="muted">Chargement…</p>}
            {!msgsLoading && !messages.length && <p className="muted">Aucun message enregistré.</p>}
            <ul className="nego-timeline">
              {messages.map((msg) => (
                <li
                  key={msg.id}
                  className={`nego-timeline-item nego-timeline-item--${msg.direction === "in" ? "in" : "out"}`}
                >
                  <div className="nego-timeline-meta">
                    <span className="nego-timeline-dir">{msg.direction === "in" ? "Reçu" : "Envoyé"}</span>
                    <time dateTime={msg.created_at}>{formatNegoDate(msg.created_at)}</time>
                    {msg.template_key && <span className="muted"> · {msg.template_key}</span>}
                  </div>
                  <p className="nego-timeline-body">{msg.body}</p>
                </li>
              ))}
            </ul>

            <h4 className="nego-timeline-title">Notes internes</h4>
            <textarea
              className="nego-notes"
              rows={4}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Notes visibles côté admin / bot…"
            />
            <button type="button" className="btn" disabled={savingNotes} onClick={() => void saveNotes()}>
              {savingNotes ? "Enregistrement…" : "Enregistrer les notes"}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeLanding />} />
        <Route path="/client" element={<Navigate to="/" replace />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/merch" element={<MerchPage />} />
        <Route path="/inventaire" element={<InventoryPage />} />
        <Route path="/projets" element={<VehicleProjectsPage />} />
        <Route path="/projets/:slug" element={<VehicleProjectDetailPage />} />
        <Route path="/connexion" element={<ConnexionPage />} />
        <Route path="/admin" element={<Navigate to="/connexion" replace />} />
        <Route path="/admin/panel" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
