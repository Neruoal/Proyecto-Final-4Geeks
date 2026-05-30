import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { AssetCard } from "../components/AssetCard";
import "../styles/Markets.css";

const BASE = import.meta.env.VITE_BACKEND_URL;

const ASSETS = [
  { ticker: "AAPL",  name: "Apple",             type: "stock" },
  { ticker: "AMD",   name: "AMD",               type: "stock" },
  { ticker: "AMZN",  name: "Amazon",            type: "stock" },
  { ticker: "BAC",   name: "Bank of America",   type: "stock" },
  { ticker: "BRK-B", name: "Berkshire Hathaway",type: "stock" },
  { ticker: "GOOGL", name: "Alphabet",          type: "stock" },
  { ticker: "HD",    name: "Home Depot",        type: "stock" },
  { ticker: "INTC",  name: "Intel",             type: "stock" },
  { ticker: "JNJ",   name: "Johnson & Johnson", type: "stock" },
  { ticker: "JPM",   name: "JPMorgan Chase",    type: "stock" },
  { ticker: "MA",    name: "Mastercard",        type: "stock" },
  { ticker: "META",  name: "Meta Platforms",    type: "stock" },
  { ticker: "MSFT",  name: "Microsoft",         type: "stock" },
  { ticker: "NFLX",  name: "Netflix",           type: "stock" },
  { ticker: "NVDA",  name: "NVIDIA",            type: "stock" },
  { ticker: "PG",    name: "Procter & Gamble",  type: "stock" },
  { ticker: "TSLA",  name: "Tesla",             type: "stock" },
  { ticker: "V",     name: "Visa",              type: "stock" },
  { ticker: "WMT",   name: "Walmart",           type: "stock" },
  { ticker: "XOM",   name: "ExxonMobil",        type: "stock" },

  { ticker: "AGG",   name: "iShares Core US Bond",     type: "etf" },
  { ticker: "ARKK",  name: "ARK Innovation",           type: "etf" },
  { ticker: "BND",   name: "Vanguard Total Bond",      type: "etf" },
  { ticker: "EFA",   name: "iShares MSCI EAFE",        type: "etf" },
  { ticker: "GLD",   name: "SPDR Gold Shares",         type: "etf" },
  { ticker: "IEMG",  name: "iShares Core EM",          type: "etf" },
  { ticker: "IWM",   name: "iShares Russell 2000",     type: "etf" },
  { ticker: "QQQ",   name: "Invesco QQQ Nasdaq 100",   type: "etf" },
  { ticker: "SCHD",  name: "Schwab US Dividend",       type: "etf" },
  { ticker: "SOXX",  name: "iShares Semiconductor",    type: "etf" },
  { ticker: "SPY",   name: "SPDR S&P 500",             type: "etf" },
  { ticker: "VEA",   name: "Vanguard Developed Mkts",  type: "etf" },
  { ticker: "VIG",   name: "Vanguard Dividend Growth", type: "etf" },
  { ticker: "VOO",   name: "Vanguard S&P 500",         type: "etf" },
  { ticker: "VTI",   name: "Vanguard Total Market",    type: "etf" },
  { ticker: "VWO",   name: "Vanguard Emerging Mkts",   type: "etf" },
  { ticker: "XLE",   name: "Energy Select SPDR",       type: "etf" },
  { ticker: "XLF",   name: "Financial Select SPDR",    type: "etf" },
  { ticker: "XLK",   name: "Technology Select SPDR",   type: "etf" },
  { ticker: "XLV",   name: "Health Care Select SPDR",  type: "etf" },

  { ticker: "ACMVX",  name: "American Funds Capital",    type: "fund" },
  { ticker: "AGTHX",  name: "American Funds Growth A",   type: "fund" },
  { ticker: "AIVSX",  name: "American Funds Invest A",   type: "fund" },
  { ticker: "DODGX",  name: "Dodge & Cox Stock",         type: "fund" },
  { ticker: "FBALX",  name: "Fidelity Balanced",         type: "fund" },
  { ticker: "FCNTX",  name: "Fidelity Contrafund",       type: "fund" },
  { ticker: "FLPSX",  name: "Fidelity Low-Priced Stock", type: "fund" },
  { ticker: "FXAIX",  name: "Fidelity 500 Index",        type: "fund" },
  { ticker: "MADVX",  name: "American Funds Balanced",   type: "fund" },
  { ticker: "PRGFX",  name: "T. Rowe Price Growth",      type: "fund" },
  { ticker: "SWTSX",  name: "Schwab Total Stock Market", type: "fund" },
  { ticker: "VBTLX",  name: "Vanguard Total Bond Adm",   type: "fund" },
  { ticker: "VEXPX",  name: "Vanguard Explorer",         type: "fund" },
  { ticker: "VFIAX",  name: "Vanguard 500 Index Adm",    type: "fund" },
  { ticker: "VGELX",  name: "Vanguard Energy Adm",       type: "fund" },
  { ticker: "VTMGX",  name: "Vanguard Developed Adm",    type: "fund" },
  { ticker: "VTSAX",  name: "Vanguard Total Stock Adm",  type: "fund" },
  { ticker: "VWIGX",  name: "Vanguard Intl Growth",      type: "fund" },
  { ticker: "VWNDX",  name: "Vanguard Windsor",          type: "fund" },
  { ticker: "VWNAX",  name: "Vanguard Windsor II Adm",   type: "fund" },

  { ticker: "ADA",   name: "Cardano",          type: "crypto" },
  { ticker: "ALGO",  name: "Algorand",         type: "crypto" },
  { ticker: "ATOM",  name: "Cosmos",           type: "crypto" },
  { ticker: "AVAX",  name: "Avalanche",        type: "crypto" },
  { ticker: "BNB",   name: "BNB",              type: "crypto" },
  { ticker: "BTC",   name: "Bitcoin",          type: "crypto" },
  { ticker: "DOGE",  name: "Dogecoin",         type: "crypto" },
  { ticker: "DOT",   name: "Polkadot",         type: "crypto" },
  { ticker: "ETH",   name: "Ethereum",         type: "crypto" },
  { ticker: "FIL",   name: "Filecoin",         type: "crypto" },
  { ticker: "ICP",   name: "Internet Computer",type: "crypto" },
  { ticker: "LINK",  name: "Chainlink",        type: "crypto" },
  { ticker: "LTC",   name: "Litecoin",         type: "crypto" },
  { ticker: "HSK", name: "Haskey Platform Token",          type: "crypto" },
  { ticker: "NEAR",  name: "NEAR Protocol",    type: "crypto" },
  { ticker: "SAND",  name: "The Sandbox",      type: "crypto" },
  { ticker: "SOL",   name: "Solana",           type: "crypto" },
  { ticker: "UNI",   name: "Uniswap",          type: "crypto" },
  { ticker: "XLM",   name: "Stellar",          type: "crypto" },
  { ticker: "XRP",   name: "XRP",              type: "crypto" },
];

const TYPE_FILTERS = [
  { label: "Todos",   value: "all"    },
  { label: "Stocks",  value: "stock"  },
  { label: "ETFs",    value: "etf"    },
  { label: "Fondos",  value: "fund"   },
  { label: "Crypto",  value: "crypto" },
];

const SIGNAL_FILTERS = [
  { label: "Todas",     value: "all"      },
  { label: "Comprar",   value: "COMPRAR"  },
  { label: "Mantener",  value: "MANTENER" },
  { label: "Vender",    value: "VENDER"   },
];

export function Markets() {
  const navigate = useNavigate();
  const token    = localStorage.getItem("token");

  const [profile,    setProfile]    = useState(null);
  const [favMap,     setFavMap]     = useState({});
  const [signals,    setSignals]    = useState({});
  const [typeFilter, setTypeFilter] = useState("all");
  const [sigFilter,  setSigFilter]  = useState("all");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const fetchData = async () => {
      try {
        const [profRes, favRes] = await Promise.all([
          fetch(`${BASE}/api/profile`,  { headers }),
          fetch(`${BASE}/api/favorite`, { headers }),
        ]);

        if (profRes.status === 401) { navigate("/login"); return; }

        const profData = await profRes.json();
        const favData  = await favRes.json();

        setProfile(profData);

        const favsByTicker = {};
        (Array.isArray(favData) ? favData : []).forEach(fav => {
          if (fav.asset_ticker) favsByTicker[fav.asset_ticker] = fav.id;
        });
        setFavMap(favsByTicker);
      } catch (err) {
        console.error("Error cargando markets:", err);
      }
    };

    fetchData();
  }, []);

  const handleFavToggle = (newId, ticker) => {
    setFavMap(prev => {
      const next = { ...prev };
      if (newId) next[ticker] = newId;
      else delete next[ticker];
      return next;
    });
  };

  const handleSignalLoaded = (ticker, signal) => {
    if (!signal) return;
    setSignals(prev => ({ ...prev, [ticker]: signal }));
  };

  const filtered = useMemo(() => {
    return ASSETS
      .filter(a => {
        const typeOk   = typeFilter === "all" || a.type === typeFilter;
        const signalOk = sigFilter  === "all" || signals[a.ticker] === sigFilter;
        return typeOk && signalOk;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [typeFilter, sigFilter, signals]);

  const loadedCount = Object.keys(signals).length;
  const isLoading   = loadedCount < ASSETS.length;

  return (
    <div className="markets-page">
      <Sidebar
        email={profile?.email ?? ""}
        fullName={profile?.full_name ?? ""}
        avatarUrl={profile?.avatar_url ?? ""}
      />

      <div className="markets-main">
        <header className="markets-topbar">
          <h2>Mercados</h2>
        </header>

        <main className="markets-content">

          <div className="markets-filters">
            <span className="filter-label">Tipo</span>
            <div className="filter-group">
              {TYPE_FILTERS.map(({ label, value }) => (
                <button
                  key={value}
                  className={`filter-btn${typeFilter === value ? " active" : ""}`}
                  onClick={() => setTypeFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="filter-divider" />

            <span className="filter-label">Señal</span>
            <div className="filter-group">
              {SIGNAL_FILTERS.map(({ label, value }) => (
                <button
                  key={value}
                  className={`filter-btn${sigFilter === value ? " active" : ""}`}
                  onClick={() => setSigFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="filter-count">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="markets-grid">
            {filtered.length === 0 ? (
              <div className="markets-empty">
                {sigFilter !== "all" && isLoading
                  ? "Cargando señales, espera un momento…"
                  : "No hay activos que coincidan con los filtros seleccionados."}
              </div>
            ) : (
              filtered.map((asset, i) => (
                <AssetCard
                  key={asset.ticker}
                  ticker={asset.ticker}
                  name={asset.name}
                  type={asset.type}
                  favoriteId={favMap[asset.ticker] ?? null}
                  onFavToggle={handleFavToggle}
                  showSignal={true}
                  delay={i * 100}
                  onSignalLoaded={handleSignalLoaded}
                />
              ))
            )}
          </div>

        </main>
      </div>
    </div>
  );
}