import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { AssetCard } from "../components/AssetCard";
import "../styles/Favorites.css";

const BASE = import.meta.env.VITE_BACKEND_URL;

const FILTERS = [
  { label: "Todos",   value: "all"    },
  { label: "Stocks",  value: "stock"  },
  { label: "ETFs",    value: "etf"    },
  { label: "Fondos",  value: "fund"   },
  { label: "Crypto",  value: "crypto" },
];

export function Favorites() {
  const navigate = useNavigate();
  const token    = localStorage.getItem("token");

  const [profile,   setProfile]   = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");

  const [favMap, setFavMap] = useState({});

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (!token) { navigate("/login"); return; }

    const fetchData = async () => {
      try {
        const [profRes, favRes] = await Promise.all([
          fetch(`${BASE}/api/profile`,  { headers }),
          fetch(`${BASE}/api/favorite`, { headers }),
        ]);

        if (profRes.status === 401) { navigate("/login"); return; }

        const [profData, favData] = await Promise.all([
          profRes.json(),
          favRes.json(),
        ]);

        setProfile(profData);

        const favList = Array.isArray(favData) ? favData : [];
        setFavorites(favList);

        const map = {};
        favList.forEach((f) => {
          if (f.asset_ticker) map[f.asset_ticker] = f.id;
        });
        setFavMap(map);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleFavToggle = (newId, ticker) => {
    if (!newId) {
        setFavorites((prev) => prev.filter((f) => f.asset_ticker !== ticker));
      setFavMap((prev) => {
        const next = { ...prev };
        delete next[ticker];
        return next;
      });
    } else {
      setFavMap((prev) => ({ ...prev, [ticker]: newId }));
    }
  };

  const filtered = filter === "all"
    ? favorites
    : favorites.filter((f) => f.asset_type === filter);

  const countByType = (type) => favorites.filter((f) => f.asset_type === type).length;

  return (
    <div className="favorites-page">

<Sidebar
  email={profile?.email ?? ""}
  fullName={profile?.full_name ?? ""}
  avatarUrl={profile?.avatar_url ?? ""}
/>
      <div className="favorites-main">

        <header className="favorites-topbar">
          <div>
            <h2>Mis favoritos</h2>
            <p>{favorites.length} activo{favorites.length !== 1 ? "s" : ""} guardado{favorites.length !== 1 ? "s" : ""}</p>
          </div>
        </header>

        <main className="favorites-content">
          {loading ? (
            <div className="favorites-loading">
              <span className="spinner-border spinner-border-sm" role="status" />
              Cargando favoritos…
            </div>
          ) : (
            <>
              <div className="filter-bar">
                {FILTERS.map(({ label, value }) => {
                  const count = value === "all" ? favorites.length : countByType(value);
                  return (
                    <button
                      key={value}
                      className={`filter-btn${filter === value ? " active" : ""}`}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                      {count > 0 && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: "0.65rem",
                          opacity: filter === value ? 0.75 : 0.5,
                        }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
                <span className="filter-count">
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="favorites-empty">
                  <div className="favorites-empty-icon">
                    ☆
                  </div>
                  <h3>
                    {filter === "all"
                      ? "Aún no tienes favoritos"
                      : `No tienes ${FILTERS.find(f => f.value === filter)?.label ?? ""} en favoritos`}
                  </h3>
                  <p>
                    {filter === "all"
                      ? "Añade activos desde el dashboard o la vista de mercados pulsando la estrella."
                      : "Prueba con otro filtro o añade activos de esta categoría desde mercados."}
                  </p>
                </div>
              ) : (
                <>
                  {filter === "all" ? (
                    FILTERS.filter(f => f.value !== "all" && countByType(f.value) > 0).map(({ label, value }) => (
                      <div key={value} className="mb-4">
                        <div className="section-title">{label}</div>
                        <div className="row g-3">
                          {favorites
                            .filter((f) => f.asset_type === value)
                            .map((fav) => (
                              <div className="col-md-3" key={fav.id}>
                                <AssetCard
                                  ticker={fav.asset_ticker}
                                  name={fav.asset_name}
                                  type={fav.asset_type}
                                  favoriteId={favMap[fav.asset_ticker] ?? fav.id}
                                  onFavToggle={handleFavToggle}
                                  showSignal={fav.asset_type !== "crypto"}
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="row g-3">
                      {filtered.map((fav) => (
                        <div className="col-md-3" key={fav.id}>
                          <AssetCard
                            ticker={fav.asset_ticker}
                            name={fav.asset_name}
                            type={fav.asset_type}
                            favoriteId={favMap[fav.asset_ticker] ?? fav.id}
                            onFavToggle={handleFavToggle}
                            showSignal={fav.asset_type !== "crypto"}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}