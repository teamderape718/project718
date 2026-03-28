import { NavLink } from "react-router-dom";
import { LogoMark } from "../LogoMark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner layout">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <LogoMark height={44} />
            <p className="site-footer-tagline">
              La vitrine officielle TEAM DÉRAPE 718 — branding, drops et univers visuel.
            </p>
          </div>
          <div>
            <h4 className="site-footer-heading">Boutique</h4>
            <ul className="site-footer-links">
              <li>
                <NavLink to="/merch">Tout le merch</NavLink>
              </li>
              <li>
                <NavLink to="/inventaire">Univers / vitrine</NavLink>
              </li>
              <li>
                <NavLink to="/videos">Vidéos</NavLink>
              </li>
              <li>
                <NavLink to="/projets">Projets véhicules</NavLink>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="site-footer-heading">Infos</h4>
            <ul className="site-footer-links">
              <li>
                <NavLink to="/">Accueil</NavLink>
              </li>
              <li>
                <NavLink to="/connexion">Connexion équipe</NavLink>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="site-footer-heading">Contact</h4>
            <ul className="site-footer-links">
              <li>
                <a href="mailto:teamderape.718@yahoo.com">teamderape.718@yahoo.com</a>
              </li>
              <li>
                <span className="site-footer-muted">Québec</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} TEAM DÉRAPE 718</span>
          <span className="site-footer-muted">Site propulsé par notre stack dédiée</span>
        </div>
      </div>
    </footer>
  );
}
