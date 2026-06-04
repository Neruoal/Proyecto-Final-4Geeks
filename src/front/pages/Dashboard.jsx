import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { AssetCard } from "../components/AssetCard";
import { AIChat } from "../components/AIChat.jsx";
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

  

function generateFakeHistory(totalLiquidity, days = 14) {
  const base  = totalLiquidity > 0 ? totalLiquidity : 5000;
  const noise = base * 0.08;
  const points = [];
  let current  = base * 0.92;

  for (let i = 0; i < days; i++) {
    current += (Math.random() - 0.4) * noise;
    current  = Math.max(current, base * 0.5);
    points.push(Math.round(current));
  }
  points[days - 1] = base;
  return points;
}

function MiniChart({ totalLiquidity }) {
  const data = useMemo(() => generateFakeHistory(totalLiquidity), [totalLiquidity]);

  const W = 560, H = 120, PAD = 8;
  const min  = Math.min(...data);
  const max  = Math.max(...data);
  const rng  = max - min || 1;
  const step = (W - PAD * 2) / (data.length - 1);

  const pts = data.map((v, i) => [
    PAD + i * step,
    H - PAD - ((v - min) / rng) * (H - PAD * 2),
  ]);

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area     = `${pts[0][0]},${H} ` + polyline + ` ${pts[pts.length - 1][0]},${H}`;

  const isUp = data[data.length - 1] >= data[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" aria-hidden="true">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={isUp ? "#16a34a" : "#dc2626"} stopOpacity="0.12" />
          <stop offset="100%" stopColor={isUp ? "#16a34a" : "#dc2626"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#chartGrad)" />
      <polyline
        points={polyline}
        fill="none"
        stroke={isUp ? "#16a34a" : "#dc2626"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3.5"
        fill={isUp ? "#16a34a" : "#dc2626"}
      />
    </svg>
  );
}

function AddFundsModal({ wallet, token, onClose, onSuccess }) {
  const [bankName, setBankName] = useState(wallet[0]?.bank_name ?? "");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState(wallet.length > 0 ? "add" : "new");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedBank = wallet.find(b => b.bank_name === bankName);
  const current = Number(selectedBank?.liquidity ?? 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!bankName || !amount) return;

    setSaving(true);
    setError("");

    const parsedAmount = parseFloat(amount);

    const method = mode === "new" ? "POST" : "PUT";
    const liquidity = mode === "add" ? current + parsedAmount : parsedAmount;

    try {
      const res = await fetch(`${BASE}/api/wallet`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bank_name: bankName,
          liquidity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al guardar.");
        return;
      }

      onSuccess(data.bank);
      onClose();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Banco y fondos</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="modal-field">
            <label className="modal-label">Operación</label>
            <div className="modal-toggle">
              <button
                type="button"
                className={`modal-toggle-btn${mode === "new" ? " active" : ""}`}
                onClick={() => {
                  setMode("new");
                  setBankName("");
                }}
              >
                Nuevo banco
              </button>

              {wallet.length > 0 && (
                <>
                  <button
                    type="button"
                    className={`modal-toggle-btn${mode === "add" ? " active" : ""}`}
                    onClick={() => {
                      setMode("add");
                      setBankName(wallet[0]?.bank_name ?? "");
                    }}
                  >
                    Añadir fondos
                  </button>

                  <button
                    type="button"
                    className={`modal-toggle-btn${mode === "set" ? " active" : ""}`}
                    onClick={() => {
                      setMode("set");
                      setBankName(wallet[0]?.bank_name ?? "");
                    }}
                  >
                    Cambiar saldo
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Banco</label>

            {mode === "new" ? (
              <input
                type="text"
                className="modal-input"
                placeholder="Santander"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                autoFocus
              />
            ) : (
              <select
                className="modal-select"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
              >
                {wallet.map(b => (
                  <option key={b.id} value={b.bank_name}>
                    {b.bank_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="modal-field">
            <label className="modal-label">
              {mode === "add" ? "Importe a añadir (€)" : "Saldo (€)"}
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              className="modal-input"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          {amount && bankName && (
            <div className="modal-preview">
              {mode === "new" ? (
                <>
                  Nuevo banco: <strong>{bankName}</strong> con <strong>{fmt(parseFloat(amount || 0))}</strong>
                </>
              ) : (
                <>
                  Saldo actual: <strong>{fmt(current)}</strong>
                  {" -> "}
                  <strong style={{ color: "#15803d" }}>
                    {mode === "add"
                      ? fmt(current + parseFloat(amount || 0))
                      : fmt(parseFloat(amount || 0))}
                  </strong>
                </>
              )}
            </div>
          )}

          {error && <div className="modal-error">{error}</div>}

          <button
            type="submit"
            className="modal-submit"
            disabled={saving || !amount || !bankName}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const token    = localStorage.getItem("token");

  const [profile,   setProfile]   = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [wallet,    setWallet]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [favMap,    setFavMap]    = useState({});
  const [showModal, setShowModal] = useState(false);

  const FEATURED = [
    { ticker: "AAPL",  name: "Apple",             type: "stock"  },
    { ticker: "VOO",   name: "Vanguard S&P 500",  type: "etf"    },
    { ticker: "VWIGX", name: "Vanguard Intl Growth", type: "fund" },
    { ticker: "BTC",   name: "Bitcoin",           type: "crypto" },
  ];

  useEffect(() => {
    if (!token) { navigate("/login"); return; }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const fetchAll = async () => {
      try {
        const [profRes, favRes, walletRes] = await Promise.all([
          fetch(`${BASE}/api/profile`,  { headers }),
          fetch(`${BASE}/api/favorite`, { headers }),
          fetch(`${BASE}/api/wallet`,   { headers }),
        ]);

        if (profRes.status === 401) { navigate("/login"); return; }

        const profData   = await profRes.json();
        const favData    = await favRes.json();
        const walletData = await walletRes.json();

        const favList       = Array.isArray(favData) ? favData : [];
        const favsByTicker  = {};
        favList.forEach(fav => {
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
    setFavMap(prev => {
      const next = { ...prev };
      if (newId) next[ticker] = newId;
      else delete next[ticker];
      return next;
    });
  };

  const handleFundsUpdate = (updatedBank) => {
  setWallet(prev => {
    const exists = prev.some(b => b.id === updatedBank.id);

    if (exists) {
      return prev.map(b => b.id === updatedBank.id ? updatedBank : b);
    }

    return [...prev, updatedBank];
  });
};

  const totalLiquidity = wallet.reduce(
    (sum, bank) => sum + Number(bank.liquidity ?? 0), 0
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
            <p>Resumen de tu cartera: {today()}</p>
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
                    <div className="chart-card-header">
                      <div>
                        <div className="chart-title">Evolución de liquidez</div>
                        <div className="chart-sub">Últimos 14 días - Saldo agregado de todos tus bancos</div>
                      </div>
                      <div className="chart-total">{fmt(totalLiquidity)}</div>
                    </div>
                    <MiniChart totalLiquidity={totalLiquidity} />
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="wallet-card">
                    <div className="wallet-card-header">
                      <div className="wallet-title">Mis bancos</div>
                      
                        <button
                          className="wallet-add-btn"
                          onClick={() => setShowModal(true)}
                        >
                          + Añadir fondos
                        </button>
                      
                    </div>
                    {wallet.length === 0 ? (
                      <p className="dash-empty">No tienes bancos vinculados aún.</p>
                    ) : (
                      <div className="wallet-list">
                        {wallet.map(bank => (
                          <div className="bank-row" key={bank.id}>
                            <div className="bank-icon">
                              {(bank.bank_name ?? "B").slice(0, 3).toUpperCase()}
                            </div>
                            <div className="bank-name">{bank.bank_name ?? "Banco"}</div>
                            <div className="bank-liquidity">{fmt(bank.liquidity)}</div>
                          </div>
                        ))}
                      </div>
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

      <AIChat />

      {showModal && (
        <AddFundsModal
          wallet={wallet}
          token={token}
          onClose={() => setShowModal(false)}
          onSuccess={handleFundsUpdate}
        />
      )}
    </div>
  );
}