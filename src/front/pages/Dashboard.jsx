import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { AssetCard } from "../components/AssetCard";
import "../styles/Dashboard.css";

const BASE = import.meta.env.VITE_BACKEND_URL;

const fmt = (n) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
};

const today = () =>
  new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function MiniChart() {
  return <div className="chart-area"></div>;
}

export function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [profile, setProfile] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [wallet, setWallet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favMap, setFavMap] = useState({});

  const FEATURED = [
    { ticker: "AAPL", name: "Apple", type: "stock" },
    { ticker: "VOO", name: "Vanguard S&P 500", type: "etf" },
    { ticker: "VWIGX", name: "Vanguard Intl Growth", type: "fund" },
    { ticker: "BTC", name: "Bitcoin", type: "crypto" }
  ];

  useEffect(() => {
    if (!token) {
      navigate("/login");
      alert("Debes iniciar sesión para acceder al dashboard")
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const fetchAll = async () => {
      try {
        const [profRes, favRes, walletRes, ] = await Promise.all([
          fetch(`${BASE}/api/profile`, { headers }),
          fetch(`${BASE}/api/favorite`, { headers }),
          fetch(`${BASE}/api/wallet`, { headers }),
        ]);

        if (profRes.status === 401) {
          navigate("/login")
          alert("Tu token ha expirado. Inicia sesión de nuevo.");
          return;
        }

        const profData = await profRes.json();
        const favData = await favRes.json();
        const walletData = await walletRes.json();

        const favList = Array.isArray(favData) ? favData : [];
        const favsByTicker = {};

        favList.forEach((fav) => {
          if (fav.asset_ticker) favsByTicker[fav.asset_ticker] = fav.id;
        });

        setProfile(profData);
        setFavorites(favList);
        setFavMap(favsByTicker);
        setWallet(Array.isArray(walletData) ? walletData : []);
      } catch (err) {
        console.error("Error cargando dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [token, navigate]);

  const handleFavToggle = (newId, ticker) => {
    setFavMap((prev) => {
      const next = { ...prev };

      if (newId) {
        next[ticker] = newId;
      } else {
        delete next[ticker];
      }

      return next;
    });
  };

  const totalLiquidity = wallet.reduce(
    (sum, bank) => sum + Number(bank.liquidity ?? 0),
    0
  );

  return (
    <div className="dash-wrap">
<Sidebar
  email={profile?.email ?? ""}
  fullName={profile?.full_name ?? ""}
  avatarUrl={profile?.avatar_url ?? ""}
/>
      <div className="dash-main">
        <header className="topbar">
          <div className="topbar-title">
            <h2>{greeting()}, {profile?.full_name?.split(" ")[0] || profile?.email?.split("@")[0] || "Usuario"}</h2>
            <p>Resumen de tu cartera · {today()}</p>
          </div>

          <div className="topbar-right">
            <button className="notif-btn" type="button">
              <span className="notif-symbol">!</span>
              <div className="notif-dot" />
            </button>
          </div>
        </header>

        <main className="dash-content">
          {loading ? (
            <div className="dash-loading">
              <span className="spinner-border spinner-border-sm" role="status" />
              Cargando tu cartera…
            </div>
          ) : (
            <>
              <div className="section-title">Resumen</div>

              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <div className="stat-card dark">
                    <div className="stat-icon stat-icon-money">€</div>
                    <div className="stat-label">Liquidez total</div>
                    <div className="stat-value">{fmt(totalLiquidity)}</div>
                    <div className="stat-sub">
                      <span className="badge-up-dark">Multibank</span>
                      {wallet.length} banco{wallet.length !== 1 ? "s" : ""} vinculado{wallet.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-fav">★</div>
                    <div className="stat-label">Favoritos</div>
                    <div className="stat-value">{favorites.length}</div>
                    <div className="stat-sub">Activos seguidos</div>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-bank">$</div>
                    <div className="stat-label">Bancos vinculados</div>
                    <div className="stat-value">{wallet.length}</div>
                    <div className="stat-sub">Saldo agregado activo</div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-8">
                  <div className="chart-card">
                    <div className="chart-title">Evolución de liquidez</div>
                    <div className="chart-sub">Últimos 14 días - Saldo agregado de todos tus bancos</div>
                    <MiniChart />
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="wallet-card">
                    <div className="wallet-title">Mis bancos</div>

                    {wallet.length === 0 ? (
                      <p className="dash-empty">No tienes bancos vinculados aún.</p>
                    ) : (
                      wallet.map((bank) => (
                        <div className="bank-row" key={bank.id}>
                          <div className="bank-icon">
                            {(bank.bank_name ?? "B").slice(0, 3).toUpperCase()}
                          </div>
                          <div className="bank-name">{bank.bank_name ?? "Banco"}</div>
                          <div className="bank-liquidity">{fmt(bank.liquidity)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="section-title">Activos destacados</div>

              <div className="row g-3 mb-4">
                {FEATURED.map((asset, i) => (
                  <div className="col-md-3" key={asset.ticker}>
                    <AssetCard
                      ticker={asset.ticker}
                      name={asset.name}
                      type={asset.type}
                      favoriteId={favMap[asset.ticker] ?? null}
                      onFavToggle={handleFavToggle}
                      showSignal={true}
                      delay={i * 1200}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}