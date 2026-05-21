import { useEffect, useState } from "react";
import "../styles/AssetCard.css";

const BASE = import.meta.env.VITE_BACKEND_URL;
const token = () => localStorage.getItem("token");

const typeLabel   = { stock: "Stock", etf: "ETF", fund: "Fondo", crypto: "Crypto" };
const signalClass = { COMPRAR: "signal-buy", VENDER: "signal-sell", MANTENER: "signal-hold" };
const signalIcon  = { COMPRAR: "↑", VENDER: "↓", MANTENER: "→" };


export function AssetCard({
  ticker,
  name,
  type = "stock",
  favoriteId = null,
  onFavToggle,
  showSignal = true,
  delay = 0,
}) {
  const endpoint = (type === "fund" || type === "etf") ? "funds" : "stocks";

  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [favId,    setFavId]    = useState(favoriteId);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    
    if (!ticker) return;
    setLoading(true);
    setError("");

    const fetchData = async () => {
      await new Promise(r => setTimeout(r, delay));
      try {
        const res = await fetch(`${BASE}/api/${endpoint}/recommendation?ticker=${ticker}`);
        if (!res.ok) throw new Error("Sin datos de cotización");
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (e) {
        setError(e.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };


    fetchData();
  }, [ticker, type]);

  useEffect(() => {
    setFavId(favoriteId);
    }, [favoriteId]);


  const handleFavToggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      if (favId) {
        await fetch(`${BASE}/api/favorite/${favId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token()}` },
        });
        setFavId(null);
        onFavToggle?.(null, ticker);
      } else {
      const resp = await fetch(`${BASE}/api/favorite/${type}/${ticker}`, {
        method: "POST",
        headers: {
      Authorization: `Bearer ${token()}`,
  },
});

const json = await resp.json();
console.log("FAVORITE RESPONSE:", json);

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

  const changeStr = data?.change_percent_30d != null
    ? data.change_percent_30d >= 0
      ? `+${data.change_percent_30d.toFixed(2)}% (30d)`
      : `${data.change_percent_30d.toFixed(2)}% (30d)`
    : null;

  const isUp = data?.change_percent_30d != null
    ? data.change_percent_30d >= 0
    : true;

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
          title={favId ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          <svg
            width="14"
            height="14"
            fill={favId ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          </svg>
        </button>
      </div>
      {loading && (
        <div className="asset-card-loading">
          <span className="spinner-border spinner-border-sm" role="status" />
          Cargando cotización…
        </div>
      )}

      {!loading && error && (
        <div className="asset-card-error">{error}</div>
      )}

      {!loading && !error && data && (
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
      )}

      {!loading && !error && showSignal && data?.signal && (
        <div className={`asset-card-signal ${signalClass[data.signal] ?? "signal-hold"}`}>
          <span>{signalIcon[data.signal] ?? "→"} {data.signal}</span>
          <span className="signal-reason">· {data.reason}</span>
        </div>
      )}

    </div>
  );
}
