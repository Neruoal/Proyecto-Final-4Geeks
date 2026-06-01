import { useEffect, useState } from "react";
import "../styles/AssetCard.css";

const BASE  = import.meta.env.VITE_BACKEND_URL;
const token = () => localStorage.getItem("token");

const typeLabel   = { stock: "Stock", etf: "ETF", fund: "Fondo", crypto: "Crypto" };
const signalClass = { COMPRAR: "signal-buy", VENDER: "signal-sell", MANTENER: "signal-hold" };
const signalIcon  = { COMPRAR: "↑", VENDER: "↓", MANTENER: "→" };

const CACHE_TTL = 6 * 60 * 60 * 1000;

function getCached(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data;
    localStorage.removeItem(key);
    return null;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

const fmtCap = (n) => {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n}`;
};

export function AssetCard({
  ticker,
  name,
  type          = "stock",
  favoriteId    = null,
  onFavToggle,
  showSignal    = true,
  delay         = 0,
  onSignalLoaded,
}) {
  const endpoint = (type === "fund" || type === "etf") ? "funds" : type === "crypto" ? "crypto" : "stocks";
  const cacheKey = `yf_${endpoint}_${ticker}`;

  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [favId,    setFavId]    = useState(favoriteId);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError("");

    const cached = getCached(cacheKey);
    if (cached) {
      setData(cached);
      onSignalLoaded?.(ticker, cached.signal);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      await new Promise(r => setTimeout(r, delay));
      try {
        const res  = await fetch(`${BASE}/api/${endpoint}/yf_recommendation?ticker=${ticker}`);
        if (!res.ok) throw new Error("Sin datos");
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
        setCache(cacheKey, json);
        onSignalLoaded?.(ticker, json.signal);
      } catch (e) {
        setError(e.message || "Error al cargar datos");
        onSignalLoaded?.(ticker, null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker, type]);

  useEffect(() => { setFavId(favoriteId); }, [favoriteId]);

  const handleFavToggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (favId) {
        await fetch(`${BASE}/api/favorite/${favId}`, {
          method:  "DELETE",
          headers: { Authorization: `Bearer ${token()}` },
        });
        setFavId(null);
        onFavToggle?.(null, ticker);
      } else {
        const resp = await fetch(`${BASE}/api/favorite/${type}/${ticker}`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${token()}` },
        });
        const json  = await resp.json();
        const newId = json.favorite?.id ?? null;
        setFavId(newId);
        onFavToggle?.(newId, ticker);
      }
    } catch (e) {
      console.error("Error toggling favorite:", e);
    } finally {
      setToggling(false);
    }
  };

  const isUp      = (data?.change_percent_30d ?? 0) >= 0;
  const changeStr = data?.change_percent_30d != null
    ? `${isUp ? "+" : ""}${data.change_percent_30d.toFixed(2)}% (30d)`
    : null;

  return (
    <div className="asset-card">

      <div className="asset-card-header">
        <div className="asset-card-left">
          <div className={`asset-card-icon icon-${type}`}>
            {ticker.slice(0, 4)}
          </div>
          <div>
            <div className="asset-card-name">{name}</div>
            <div className="asset-card-ticker">{ticker}</div>
          </div>
        </div>
        <span className={`asset-card-type type-${type}`}>
          {typeLabel[type] ?? type}
        </span>
        <button
          className={`asset-card-fav-btn${favId ? " active" : ""}`}
          onClick={handleFavToggle}
          disabled={toggling}
          aria-label={favId ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          <svg width="14" height="14" fill={favId ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
        </button>
      </div>

      {loading && (
        <div className="asset-card-loading">
          <span className="spinner-border spinner-border-sm" role="status" />
          Cargando…
        </div>
      )}

      {!loading && error && (
        <div className="asset-card-error">{error}</div>
      )}

      {!loading && !error && data && (
        <>
          <div className="asset-card-price-row">
            <div className="asset-card-price">
              ${parseFloat(data.price).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            {changeStr && (
              <div className={`asset-card-change ${isUp ? "up" : "down"}`}>
                {changeStr}
              </div>
            )}
          </div>

          <div className="asset-card-meta">
            {data.sector && (
              <div className="asset-card-meta-item">
                <span className="meta-label">Sector</span>
                <span className="meta-value">{data.sector}</span>
              </div>
            )}
            {(data.week_52_high || data.week_52_low) && (
              <div className="asset-card-meta-item">
                <span className="meta-label">52w</span>
                <span className="meta-value">
                  {data.week_52_low ? `$${data.week_52_low}` : "—"}
                  {" · "}
                  {data.week_52_high ? `$${data.week_52_high}` : "—"}
                </span>
              </div>
            )}
            {data.market_cap && (
              <div className="asset-card-meta-item">
                <span className="meta-label">Cap</span>
                <span className="meta-value">{fmtCap(data.market_cap)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !error && showSignal && data?.signal && (
        <div className={`asset-card-signal ${signalClass[data.signal] ?? "signal-hold"}`} style={{ marginTop: "auto" }}>
          <span>{signalIcon[data.signal] ?? "→"} {data.signal}</span>
          <span className="signal-reason">· {data.reason}</span>
        </div>
      )}

    </div>
  );
}