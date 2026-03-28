import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import { LogoMark } from "../LogoMark";

type Merch = {
  id: number;
  name: string;
  description: string;
  price_cad: string | null;
  image_url: string | null;
  external_url: string | null;
};

export function HomeLanding() {
  const [merch, setMerch] = useState<Merch[]>([]);

  useEffect(() => {
    api<Merch[]>("/api/public/merch")
      .then(setMerch)
      .catch(() => setMerch([]));
  }, []);

  const featured = merch.slice(0, 8);

  function newsletterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    if (!email) return;
    window.location.href = `mailto:teamderape.718@yahoo.com?subject=${encodeURIComponent("Inscription info TEAM DÉRAPE 718")}&body=${encodeURIComponent(`Mon email : ${email}`)}`;
  }

  return (
    <div className="home-lander">
      {/* Hero type Drift HQ : impact + preuves */}
      <section className="ld-hero">
        <div className="ld-hero-grid layout">
          <div className="ld-hero-copy">
            <p className="ld-kicker anim-fade-up">TEAM DÉRAPE 718 · Québec</p>
            <h1 className="ld-hero-title anim-fade-up" style={{ animationDelay: "0.06s" }}>
              Ta source
              <span className="ld-hero-accent"> officielle</span>
            </h1>
            <p className="ld-hero-sub anim-fade-up" style={{ animationDelay: "0.12s" }}>
              Merch, contenus vidéo et vitrine — le même niveau d’exigence qu’une grande plateforme,
              avec notre identité violet &amp; lime. Entre sur le site, tu sais où tu es.
            </p>
            <div className="ld-hero-cta anim-fade-up" style={{ animationDelay: "0.18s" }}>
              <NavLink to="/merch" className="ld-btn ld-btn--primary">
                Shop la boutique
              </NavLink>
              <NavLink to="/videos" className="ld-btn ld-btn--outline">
                Voir les vidéos
              </NavLink>
              <NavLink to="/projets" className="ld-btn ld-btn--outline">
                Projets build
              </NavLink>
            </div>
            <ul className="ld-hero-stats anim-fade-up" style={{ animationDelay: "0.24s" }}>
              <li>
                <strong>Nouveautés</strong>
                <span>Ajoutées via l’admin</span>
              </li>
              <li>
                <strong>100% nous</strong>
                <span>Marque indépendante</span>
              </li>
              <li>
                <strong>Canada</strong>
                <span>Basé au Québec</span>
              </li>
            </ul>
          </div>
          <div className="ld-hero-visual anim-fade-up" style={{ animationDelay: "0.14s" }}>
            <div className="ld-hero-card">
              <div className="ld-hero-card-glow" aria-hidden />
              <LogoMark height={120} className="ld-hero-logo" />
              <p className="ld-hero-card-caption">IDENTITÉ · DROPS · COMMUNAUTÉ</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bandeau confiance (comme same day / returns sur Drift HQ) */}
      <section className="ld-trust">
        <div className="layout ld-trust-inner">
          <div className="ld-trust-item">
            <span className="ld-trust-icon" aria-hidden>
              ◆
            </span>
            <div>
              <strong>Contenu à jour</strong>
              <span>Géré depuis le panneau sécurisé</span>
            </div>
          </div>
          <div className="ld-trust-item">
            <span className="ld-trust-icon" aria-hidden>
              ✦
            </span>
            <div>
              <strong>Liens merch</strong>
              <span>Redirection vers nos ventes partenaires</span>
            </div>
          </div>
          <div className="ld-trust-item">
            <span className="ld-trust-icon" aria-hidden>
              ★
            </span>
            <div>
              <strong>Vitrine publique</strong>
              <span>Vidéos &amp; univers accessibles à tous</span>
            </div>
          </div>
        </div>
      </section>

      {/* Shop by category */}
      <section className="ld-section">
        <div className="layout">
          <p className="ld-section-label">Explorer</p>
          <h2 className="ld-section-title">Shop par univers</h2>
          <p className="ld-section-lead">
            Quatre portes d’entrée — même expérience premium, comme sur les grosses boutiques US.
          </p>
          <div className="ld-cat-grid">
            <NavLink to="/merch" className="ld-cat-tile ld-cat-tile--merch">
              <span className="ld-cat-label">Boutique</span>
              <span className="ld-cat-title">Merch &amp; pièces</span>
              <span className="ld-cat-arrow">→</span>
            </NavLink>
            <NavLink to="/videos" className="ld-cat-tile ld-cat-tile--video">
              <span className="ld-cat-label">Médias</span>
              <span className="ld-cat-title">Vidéos</span>
              <span className="ld-cat-arrow">→</span>
            </NavLink>
            <NavLink to="/inventaire" className="ld-cat-tile ld-cat-tile--world">
              <span className="ld-cat-label">Vitrine</span>
              <span className="ld-cat-title">Univers 718</span>
              <span className="ld-cat-arrow">→</span>
            </NavLink>
            <NavLink to="/projets" className="ld-cat-tile ld-cat-tile--projects">
              <span className="ld-cat-label">Build</span>
              <span className="ld-cat-title">Projets véhicules</span>
              <span className="ld-cat-arrow">→</span>
            </NavLink>
          </div>
        </div>
      </section>

      {/* Featured products row */}
      <section className="ld-section ld-section--dark">
        <div className="layout">
          <div className="ld-section-head">
            <div>
              <p className="ld-section-label">À l’affiche</p>
              <h2 className="ld-section-title">Sélection boutique</h2>
            </div>
            <NavLink to="/merch" className="ld-link-all">
              Tout voir →
            </NavLink>
          </div>
          {featured.length > 0 ? (
            <div className="ld-product-scroll">
              {featured.map((m) => (
                <article key={m.id} className="ld-product-card">
                  <div className="ld-product-media">
                    {m.image_url ? (
                      <img src={m.image_url} alt="" loading="lazy" />
                    ) : (
                      <div className="ld-product-placeholder">718</div>
                    )}
                  </div>
                  <h3 className="ld-product-name">{m.name}</h3>
                  {m.price_cad != null && <p className="ld-product-price">{m.price_cad} $ CAD</p>}
                  {m.external_url ? (
                    <a href={m.external_url} className="ld-product-link" target="_blank" rel="noreferrer">
                      Détails
                    </a>
                  ) : (
                    <NavLink to="/merch" className="ld-product-link">
                      Voir la boutique
                    </NavLink>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="ld-empty-shelf">
              <p>La sélection arrive bientôt — ajoute tes produits depuis la connexion équipe.</p>
              <NavLink to="/connexion" className="ld-btn ld-btn--outline ld-btn--sm">
                Connexion
              </NavLink>
            </div>
          )}
        </div>
      </section>

      {/* CTA band */}
      <section className="ld-cta-band">
        <div className="layout ld-cta-band-inner">
          <div>
            <h2 className="ld-cta-title">Rejoins le mouvement</h2>
            <p className="ld-cta-text">Suis les drops, les vidéos et l’univers TEAM DÉRAPE 718.</p>
          </div>
          <NavLink to="/merch" className="ld-btn ld-btn--lime">
            Shop maintenant
          </NavLink>
        </div>
      </section>

      {/* Newsletter */}
      <section className="ld-section">
        <div className="layout ld-newsletter">
          <div>
            <p className="ld-section-label">Reste informé</p>
            <h2 className="ld-section-title">Newsletter</h2>
            <p className="ld-section-lead">Envoie ton email — on t’ouvre un message prêt à partir.</p>
          </div>
          <form className="ld-news-form" onSubmit={newsletterSubmit}>
            <input type="email" name="email" required placeholder="ton@email.com" className="ld-news-input" />
            <button type="submit" className="ld-btn ld-btn--primary">
              S’inscrire
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
