import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import "../styles/News.css";

const BASE = import.meta.env.VITE_BACKEND_URL;

function Placeholder1() {
  return (
    <div className="news-ph news-ph-1">
      <div className="ph-lines">
        {[-40, -10, 20, 50, 80, 110, 140].map((top, i) => (
          <div key={i} className="ph-line" style={{ top }} />
        ))}
      </div>
      <div className="ph-dot">
        <div className="ph-dot-inner" />
      </div>
    </div>
  );
}

function Placeholder2() {
  const bars = [30, 50, 70, 45, 85, 60, 40, 95];
  return (
    <div className="news-ph news-ph-2">
      <svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0,70 C30,60 50,40 80,45 C110,50 130,25 160,20 C180,17 190,22 200,18"
          fill="none" stroke="#1e2025" strokeWidth="1.5" strokeOpacity="0.15" strokeLinecap="round"
        />
        <path
          d="M0,80 C30,70 50,55 80,58 C110,61 130,42 160,38 C180,35 190,40 200,36 L200,100 L0,100 Z"
          fill="#1e2025" fillOpacity="0.04"
        />
      </svg>
      <div className="ph-bars">
        {bars.map((h, i) => (
          <div key={i} className={`ph-bar${h > 70 ? " hi" : ""}`} style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

function Placeholder3() {
  const cells = [
    "", "mid", "", "lit",
    "mid", "", "mid", "",
    "lit", "mid", "", "mid",
    "", "lit", "mid", "",
    "mid", "", "lit", "mid",
  ];
  return (
    <div className="news-ph news-ph-3">
      <div className="ph-grid">
        {cells.map((cls, i) => (
          <div key={i} className={`ph-cell${cls ? ` ${cls}` : ""}`} />
        ))}
      </div>
    </div>
  );
}

const PLACEHOLDERS = [Placeholder1, Placeholder2, Placeholder3];

function NewsPlaceholder({ index }) {
  const Ph = PLACEHOLDERS[index % 3];
  return <Ph />;
}

function NewsCard({ item, index, featured = false }) {
  const [imgError, setImgError] = useState(false);

  return (
    <a
      href={item.url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={`news-card${featured ? " featured" : ""}`}
    >
      {item.image && !imgError ? (
        <img
          src={item.image}
          alt={item.title}
          className="news-card-img"
          onError={() => setImgError(true)}
        />
      ) : (
        <NewsPlaceholder index={index} />
      )}
      <div className="news-card-body">
        <div className="news-card-source">{item.source ?? "Fuente desconocida"}</div>
        <div className="news-card-title">{item.title}</div>
        {item.content && (
          <div className="news-card-desc">{item.content}</div>
        )}
        <div className="news-card-link">
          {featured ? "Leer artículo completo" : "Leer más"} ↗
        </div>
      </div>
    </a>
  );
}

export function News() {
  const navigate = useNavigate();
  const token    = localStorage.getItem("token");

  const [profile,    setProfile]    = useState(null);
  const [news,       setNews]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const fetchData = async () => {
      setLoading(true);
      setError("");
      window.scrollTo(0, 0);

      try {
        const [profRes, newsRes] = await Promise.all([
          fetch(`${BASE}/api/profile`, { headers }),
          fetch(`${BASE}/api/news?page=${page}`),
        ]);

        if (profRes.status === 401) { navigate("/login"); return; }

        const profData = await profRes.json();
        const newsData = await newsRes.json();

        setProfile(profData);

        if (newsData.error) {
          setError(newsData.error);
        } else {
          setNews(Array.isArray(newsData.articles) ? newsData.articles : []);
          setTotalPages(Math.ceil((newsData.total ?? 0) / 10));
        }
      } catch (e) {
        setError("Error de conexión. Inténtalo de nuevo.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page]);

  const featured = news[0] ?? null;
  const rest     = news.slice(1);

  return (
    <div className="news-page">
      <Sidebar
        email={profile?.email ?? ""}
        fullName={profile?.full_name ?? ""}
        avatarUrl={profile?.avatar_url ?? ""}
      />

      <div className="news-main">
        <header className="news-topbar">
          <h2>Noticias</h2>
          <p>
            Últimas noticias financieras
            {totalPages > 1 && ` · Página ${page} de ${totalPages}`}
          </p>
        </header>

        <main className="news-content">
          {loading ? (
            <div className="news-loading">
              <span className="spinner-border spinner-border-sm" role="status" />
              Cargando noticias…
            </div>
          ) : error ? (
            <div className="news-empty">
              <h3>No se pudieron cargar las noticias</h3>
              <p>{error}</p>
            </div>
          ) : news.length === 0 ? (
            <div className="news-empty">
              <h3>Sin noticias disponibles</h3>
              <p>No hay noticias en este momento. Inténtalo más tarde.</p>
            </div>
          ) : (
            <>
              <div className="section-title">Últimas noticias</div>

              {featured && <NewsCard item={featured} index={0} featured />}

              {rest.length > 0 && (
                <div className="news-grid">
                  {rest.map((item, i) => (
                    <NewsCard key={item.id ?? i} item={item} index={i + 1} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="d-flex align-items-center justify-content-center gap-3 mt-4">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    style={{ borderRadius: 8, fontSize: "0.8rem" }}
                  >
                    ← Anterior
                  </button>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    style={{ borderRadius: 8, fontSize: "0.8rem" }}
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}