import React, { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, getToken, setToken } from "./api";

/** Email du compte administrateur (prérempli sur la page de connexion). */
const ADMIN_LOGIN_EMAIL = "teamderape.718@yahoo.com";

function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      className={className}
      src="/logo.png"
      alt="TEAM DÉRAPE 718 — Performance mécanique"
      onError={(e) => {
        const el = e.currentTarget;
        if (!el.src.endsWith("/logo.svg")) el.src = "/logo.svg";
      }}
    />
  );
}

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

type Nego = {
  id: number;
  listing_url: string | null;
  title: string | null;
  seller_phone: string | null;
  stage: string;
  notes: string;
  last_action_at: string;
};

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="layout">
      <nav className="top">
        <NavLink to="/" className="nav-brand">
          <BrandLogo />
          <span className="nav-brand-text">
            <span className="sub">Performance mécanique</span>
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
            Véhicules &amp; machines
          </NavLink>
          <span className="nav-cta">
            <NavLink to="/connexion">Connexion</NavLink>
          </span>
        </div>
      </nav>
      {children}
    </div>
  );
}

function Home() {
  return (
    <div>
      <section className="hero">
        <span className="hero-badge">Québec · Mécanique performance</span>
        <h1>
          <span className="hl-purple">Mécanique</span> de précision,{" "}
          <span className="hl-lime">l’énergie</span> du 718.
        </h1>
        <p className="hero-lead">
          Boutique officielle, inventaire véhicules &amp; machines, contenus vidéo. Une seule connexion
          sécurisée pour gérer le site. Alertes deals et actions via notre{" "}
          <strong style={{ color: "var(--lime)" }}>bot Telegram</strong> (scan Kijiji, SMS selon
          configuration).
        </p>
        <div className="hero-actions">
          <NavLink className="primary" to="/merch">
            Voir la boutique
          </NavLink>
          <NavLink className="ghost" to="/inventaire">
            Inventaire
          </NavLink>
          <NavLink className="ghost" to="/videos">
            Vidéos
          </NavLink>
        </div>
      </section>

      <div className="card-grid two">
        <div className="card">
          <h3>Vidéos</h3>
          <p className="muted">Clips, projets et contenus sélectionnés.</p>
          <NavLink to="/videos">Voir la section →</NavLink>
        </div>
        <div className="card">
          <h3>Inventaire</h3>
          <p className="muted">Véhicules et machines en vitrine.</p>
          <NavLink to="/inventaire">Voir l’inventaire →</NavLink>
        </div>
      </div>

      <p className="footer-note">
        Le catalogue est public. Pour modifier produits, vidéos et fiches :{" "}
        <NavLink to="/connexion">Connexion</NavLink> (compte administrateur).
      </p>
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
  if (err) return <p className="muted">{err}</p>;
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Vidéos</h1>
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
  useEffect(() => {
    api<Merch[]>("/api/public/merch")
      .then(setRows)
      .catch((e) => setErr(String(e.message)));
  }, []);
  if (err) return <p className="muted">{err}</p>;
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Merch</h1>
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
            {m.external_url && (
              <a href={m.external_url} target="_blank" rel="noreferrer">
                Acheter / Infos
              </a>
            )}
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
  if (err) return <p className="muted">{err}</p>;
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Inventaire</h1>
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
    <div className="login-card">
      <div className="logo-wrap">
        <BrandLogo />
      </div>
      <h1>Connexion</h1>
      <p className="muted" style={{ marginTop: "-0.25rem", marginBottom: "1.25rem" }}>
        Accès réservé à l’administration du site (contenu, inventaire, négociations).
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
  );
}

function AdminPanel() {
  const [tab, setTab] = useState<"videos" | "merch" | "inv" | "nego">("videos");
  const [videos, setVideos] = useState<Video[]>([]);
  const [merch, setMerch] = useState<Merch[]>([]);
  const [inv, setInv] = useState<Inv[]>([]);
  const [nego, setNego] = useState<Nego[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    if (!getToken()) return;
    const load = async () => {
      try {
        const [v, m, i, n] = await Promise.all([
          api<Video[]>("/api/admin/videos"),
          api<Merch[]>("/api/admin/merch"),
          api<Inv[]>("/api/admin/inventory"),
          api<Nego[]>("/api/admin/negotiations"),
        ]);
        setVideos(v);
        setMerch(m);
        setInv(i);
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
    <div>
      <h1>Administration</h1>
      <div className="admin-tabs">
        <button type="button" className={tab === "videos" ? "on" : ""} onClick={() => setTab("videos")}>
          Vidéos
        </button>
        <button type="button" className={tab === "merch" ? "on" : ""} onClick={() => setTab("merch")}>
          Merch
        </button>
        <button type="button" className={tab === "inv" ? "on" : ""} onClick={() => setTab("inv")}>
          Inventaire
        </button>
        <button type="button" className={tab === "nego" ? "on" : ""} onClick={() => setTab("nego")}>
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
      {tab === "inv" && (
        <AdminInvForm rows={inv} onRefresh={async () => setInv(await api<Inv[]>("/api/admin/inventory"))} />
      )}
      {tab === "nego" && <AdminNego rows={nego} onRefresh={async () => setNego(await api<Nego[]>("/api/admin/negotiations"))} />}
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
        published,
      }),
    });
    setName("");
    setDesc("");
    setPrice("");
    setImg("");
    setExt("");
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
        <div key={m.id} className="card" style={{ marginBottom: "0.75rem" }}>
          {m.name} — {m.published ? "publié" : "brouillon"}
          <button type="button" className="btn secondary" style={{ marginLeft: "0.5rem" }} onClick={() => del(m.id)}>
            Supprimer
          </button>
        </div>
      ))}
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

function AdminNego({ rows, onRefresh }: { rows: Nego[]; onRefresh: () => Promise<void> }) {
  async function patch(id: number, stage: string) {
    await api(`/api/admin/negotiations/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
    await onRefresh();
  }

  return (
    <div>
      <h2>Négociations (bot / deals)</h2>
      {rows.map((n) => (
        <div key={n.id} className="card" style={{ marginBottom: "0.75rem" }}>
          <strong>{n.title ?? "Sans titre"}</strong>
          <p className="muted">{n.listing_url}</p>
          <p>Tél. : {n.seller_phone ?? "—"}</p>
          <p>Étape : {n.stage}</p>
          <select
            value={n.stage}
            onChange={(e) => patch(n.id, e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="new">new</option>
            <option value="contacted">contacted</option>
            <option value="negotiating">negotiating</option>
            <option value="won">won</option>
            <option value="lost">lost</option>
          </select>
        </div>
      ))}
      {!rows.length && <p className="muted">Aucune négociation enregistrée.</p>}
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/client" element={<Navigate to="/" replace />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/merch" element={<MerchPage />} />
        <Route path="/inventaire" element={<InventoryPage />} />
        <Route path="/connexion" element={<ConnexionPage />} />
        <Route path="/admin" element={<Navigate to="/connexion" replace />} />
        <Route path="/admin/panel" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
