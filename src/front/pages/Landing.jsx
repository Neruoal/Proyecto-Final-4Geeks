import { Link } from "react-router-dom";
import "../styles/Landing.css";

function HeroChart() {
  const pts = [22, 28, 18, 32, 26, 38, 30, 42, 36, 44, 40, 48];
  const W = 300, H = 44;
  const max = Math.max(...pts), min = Math.min(...pts);
  const step = W / (pts.length - 1);
  const coords = pts.map((v, i) => [
    i * step,
    H - ((v - min) / (max - min)) * (H - 4) - 2,
  ]);
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="lv-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#16a34a" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0"    />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#lg)" />
      <polyline points={line} fill="none" stroke="#16a34a" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  { icon: "📊", title: "Mercados en tiempo real",  desc: "80 activos entre stocks, ETFs, fondos y crypto con señales COMPRAR / MANTENER / VENDER para identificar la mejor jugada." },
  { icon: "🤖", title: "Asesor IA",                desc: "Chat con EconomIA enriquecido con datos del mercado. Pregunta sobre cualquier activo en lenguaje natural." },
  { icon: "⭐", title: "Favoritos",                desc: "Guarda tus activos favoritos y accede rápidamente con filtros por tipo y señal." },
  { icon: "📰", title: "Noticias financieras",     desc: "Feed de noticias actualizado sobre mercados, bolsa e inversión con imágenes y paginación." },
  { icon: "🏦", title: "Gestión de cartera",       desc: "Registra tu liquidez por banco y visualiza la evolución de tu patrimonio." },
  { icon: "🔒", title: "Seguro y privado",         desc: "Autenticación JWT y sin almacenamiento de credenciales bancarias." },
];

const ASSETS_PREVIEW = [
  { ticker: "AAPL", name: "Apple",         price: "$312.51", signal: "COMPRAR", sigClass: "sig-buy",  bg: "#eff6ff", color: "#3b82f6" },
  { ticker: "BTC",  name: "Bitcoin",       price: "$67.2k",  signal: "MANTENER",sigClass: "sig-hold", bg: "#fef9c3", color: "#ca8a04" },
  { ticker: "VOO",  name: "Vanguard S&P",  price: "$493.10", signal: "COMPRAR", sigClass: "sig-buy",  bg: "#f0fdf4", color: "#16a34a" },
];

export function Landing() {
  return (
    <div className="landing-page">

      <nav className="landing-nav">
        <Link to="/" className="landing-brand">
          <div className="landing-brand-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 12L6 7L9.5 10L13 4" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="13" cy="4" r="1.2" fill="#ffffff"/>
            </svg>
          </div>
          <span className="landing-brand-name">ECONOMOS</span>
        </Link>

        <div className="landing-nav-links">
          <Link to="/login"    className="landing-nav-btn outline">Iniciar sesión</Link>
          <Link to="/register" className="landing-nav-btn">Empezar gratis</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div>
          <div className="landing-hero-badge">
            <div className="landing-hero-badge-dot" />
            Datos en tiempo real
          </div>
          <h1>
            Tu cartera,<br />
            <em>más inteligente</em>
          </h1>
          <p className="landing-hero-desc">
            Economos centraliza tus activos, noticias financieras y un asesor IA en un solo lugar. Toma mejores decisiones con datos en tiempo real.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="btn-dark">Crear cuenta gratis →</Link>
            <Link to="/login"    className="btn-outline">Iniciar sesión</Link>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="lv-card">
            <div className="lv-label">Liquidez total</div>
            <div className="lv-value">€24.830</div>
            <div className="lv-change">+2.4% este mes</div>
            <HeroChart />
          </div>

          <div className="lv-row">
            <div className="lv-card small">
              <div className="lv-label">Favoritos</div>
              <div className="lv-value">12</div>
            </div>
            <div className="lv-card small">
              <div className="lv-label">Bancos</div>
              <div className="lv-value">3</div>
            </div>
          </div>

          <div className="lv-card">
            <div className="lv-label">Activos destacados</div>
            <div className="lv-assets">
              {ASSETS_PREVIEW.map(a => (
                <div className="lv-asset" key={a.ticker}>
                  <div className="lv-asset-icon" style={{ background: a.bg, color: a.color }}>
                    {a.ticker.slice(0, 4)}
                  </div>
                  <div className="lv-asset-name">{a.name}</div>
                  <div className="lv-asset-price">{a.price}</div>
                  <span className={`lv-signal ${a.sigClass}`}>{a.signal}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="landing-stats">
        <div className="landing-stat">
          <div className="landing-stat-num">80+</div>
          <div className="landing-stat-desc">Activos disponibles</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-num">4</div>
          <div className="landing-stat-desc">Tipos de activo</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-num">0€</div>
          <div className="landing-stat-desc">Coste de acceso</div>
        </div>
        <div className="landing-stat">
          <div className="landing-stat-num">24/7</div>
          <div className="landing-stat-desc">Datos actualizados</div>
        </div>
      </div>

      <section className="landing-features" id="features">
        <div className="landing-section-tag">Funcionalidades</div>
        <h2 className="landing-section-title">Todo lo que necesitas para invertir mejor</h2>
        <div className="features-grid">
          {FEATURES.map(f => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2>Empieza a invertir con claridad</h2>
        <p>Crea tu cuenta en segundos y accede a datos de mercado, noticias y un asesor IA sin coste.</p>
        <div className="landing-hero-actions" style={{ justifyContent: "center" }}>
          <Link to="/register" className="btn-white">Crear cuenta gratis →</Link>
          <Link to="/login"    className="btn-ghost">Ya tengo cuenta</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-footer-copy">© 2026 Economos</span>
        <div className="landing-footer-links">
          <Link to="/login"    className="landing-footer-link">Iniciar sesión</Link>
          <Link to="/register" className="landing-footer-link">Registrarse</Link>
        </div>
      </footer>

    </div>
  );
}