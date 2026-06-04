import { useEffect, useRef, useState } from "react";
import "../styles/AIChat.css";

const BASE = import.meta.env.VITE_BACKEND_URL;
const token = () => localStorage.getItem("token");

const ASSETS = [
  { ticker: "AAPL", name: "Apple", type: "stock" },
  { ticker: "AMD", name: "AMD", type: "stock" },
  { ticker: "AMZN", name: "Amazon", type: "stock" },
  { ticker: "BAC", name: "Bank of America", type: "stock" },
  { ticker: "BRK-B", name: "Berkshire Hathaway", type: "stock" },
  { ticker: "GOOGL", name: "Alphabet", type: "stock" },
  { ticker: "HD", name: "Home Depot", type: "stock" },
  { ticker: "INTC", name: "Intel", type: "stock" },
  { ticker: "JNJ", name: "Johnson & Johnson", type: "stock" },
  { ticker: "JPM", name: "JPMorgan Chase", type: "stock" },
  { ticker: "MA", name: "Mastercard", type: "stock" },
  { ticker: "META", name: "Meta", type: "stock" },
  { ticker: "MSFT", name: "Microsoft", type: "stock" },
  { ticker: "NFLX", name: "Netflix", type: "stock" },
  { ticker: "NVDA", name: "NVIDIA", type: "stock" },
  { ticker: "PG", name: "Procter & Gamble", type: "stock" },
  { ticker: "TSLA", name: "Tesla", type: "stock" },
  { ticker: "V", name: "Visa", type: "stock" },
  { ticker: "WMT", name: "Walmart", type: "stock" },
  { ticker: "XOM", name: "ExxonMobil", type: "stock" },
  { ticker: "AGG", name: "iShares Core US Bond", type: "etf" },
  { ticker: "ARKK", name: "ARK Innovation", type: "etf" },
  { ticker: "BND", name: "Vanguard Total Bond", type: "etf" },
  { ticker: "EFA", name: "iShares MSCI EAFE", type: "etf" },
  { ticker: "GLD", name: "SPDR Gold Shares", type: "etf" },
  { ticker: "IEMG", name: "iShares Core EM", type: "etf" },
  { ticker: "IWM", name: "iShares Russell 2000", type: "etf" },
  { ticker: "QQQ", name: "Invesco QQQ", type: "etf" },
  { ticker: "SCHD", name: "Schwab Dividend", type: "etf" },
  { ticker: "SOXX", name: "iShares Semiconductor", type: "etf" },
  { ticker: "SPY", name: "SPDR S&P 500", type: "etf" },
  { ticker: "VEA", name: "Vanguard Developed Markets", type: "etf" },
  { ticker: "VIG", name: "Vanguard Dividend Growth", type: "etf" },
  { ticker: "VOO", name: "Vanguard S&P 500", type: "etf" },
  { ticker: "VTI", name: "Vanguard Total Market", type: "etf" },
  { ticker: "VWO", name: "Vanguard Emerging Markets", type: "etf" },
  { ticker: "XLE", name: "Energy Select SPDR", type: "etf" },
  { ticker: "XLF", name: "Financial Select SPDR", type: "etf" },
  { ticker: "XLK", name: "Technology Select SPDR", type: "etf" },
  { ticker: "XLV", name: "Health Care Select SPDR", type: "etf" },
  { ticker: "ACMVX", name: "American Funds Capital", type: "fund" },
  { ticker: "AGTHX", name: "American Funds Growth", type: "fund" },
  { ticker: "DODGX", name: "Dodge & Cox Stock", type: "fund" },
  { ticker: "FBALX", name: "Fidelity Balanced", type: "fund" },
  { ticker: "FCNTX", name: "Fidelity Contrafund", type: "fund" },
  { ticker: "FXAIX", name: "Fidelity 500 Index", type: "fund" },
  { ticker: "PRGFX", name: "T. Rowe Price Growth", type: "fund" },
  { ticker: "VFIAX", name: "Vanguard 500 Index", type: "fund" },
  { ticker: "VTSAX", name: "Vanguard Total Stock", type: "fund" },
  { ticker: "VWIGX", name: "Vanguard Intl Growth", type: "fund" },
  { ticker: "ADA", name: "Cardano", type: "crypto" },
  { ticker: "ATOM", name: "Cosmos", type: "crypto" },
  { ticker: "BNB", name: "BNB", type: "crypto" },
  { ticker: "BTC", name: "Bitcoin", type: "crypto" },
  { ticker: "DOGE", name: "Dogecoin", type: "crypto" },
  { ticker: "ETH", name: "Ethereum", type: "crypto" },
  { ticker: "LINK", name: "Chainlink", type: "crypto" },
  { ticker: "LTC", name: "Litecoin", type: "crypto" },
  { ticker: "NEAR", name: "NEAR Protocol", type: "crypto" },
  { ticker: "SOL", name: "Solana", type: "crypto" },
  { ticker: "XRP", name: "XRP", type: "crypto" },
];

function findAssets(text) {
  const value = text.trim().toLowerCase();

  if (!value) return [];

  return ASSETS.filter((item) => {
    return (
      item.ticker.toLowerCase().includes(value) ||
      item.name.toLowerCase().includes(value)
    );
  }).slice(0, 6);
}

const firstMessage = {
  role: "bot",
  text: "Hola, dime qué activo quieres revisar y te ayudo.",
};

export function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([firstMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState([]);
  const [asset, setAsset] = useState(null);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const onSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    setMatches(findAssets(value));
  };

  const chooseAsset = (item) => {
    setAsset(item);
    setSearch("");
    setMatches([]);
  };

  const removeAsset = () => {
    setAsset(null);
    setSearch("");
    setMatches([]);
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    const question = input.trim();

    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE}/api/ask-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          question,
          ticker: asset?.ticker ?? "",
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.answer || data.error || "No he podido responder.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Error de conexión. Prueba otra vez.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;

    e.preventDefault();
    sendMessage(e);
  };

  return (
    <>
      <button className="ai-chat-btn" onClick={() => setOpen(!open)}>
        {open ? "x" : <svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 640 640"
  width="20"
  height="20"
  fill="currentColor"
>
  <path d="M320 544C461.4 544 576 436.5 576 304C576 171.5 461.4 64 320 64C178.6 64 64 171.5 64 304C64 358.3 83.2 408.3 115.6 448.5L66.8 540.8C62 549.8 63.5 560.8 70.4 568.3C77.3 575.8 88.2 578.1 97.5 574.1L215.9 523.4C247.7 536.6 282.9 544 320 544zM192 272C209.7 272 224 286.3 224 304C224 321.7 209.7 336 192 336C174.3 336 160 321.7 160 304C160 286.3 174.3 272 192 272zM320 272C337.7 272 352 286.3 352 304C352 321.7 337.7 336 320 336C302.3 336 288 321.7 288 304C288 286.3 302.3 272 320 272zM416 304C416 286.3 430.3 272 448 272C465.7 272 480 286.3 480 304C480 321.7 465.7 336 448 336C430.3 336 416 321.7 416 304z" />
</svg>}
      </button>

      {open && (
        <div className="ai-chat-panel">
          <div className="ai-chat-header">
            <div className="ai-chat-avatar">AI</div>

            <div className="ai-chat-header-info">
              <p className="ai-chat-title">Asesor financiero</p>
              <p className="ai-chat-subtitle">Gemini</p>
            </div>

            <button className="ai-chat-close" onClick={() => setOpen(false)}>
              x
            </button>
          </div>

          <div className="ai-chat-ticker-bar">
            <input
              type="text"
              className="ai-chat-ticker-input"
              placeholder="Buscar activo"
              value={search}
              onChange={onSearch}
              autoComplete="off"
            />

            {matches.length > 0 && (
              <div className="ai-chat-ticker-results">
                {matches.map((item) => (
                  <button
                    key={item.ticker}
                    className="ai-chat-ticker-item"
                    onClick={() => chooseAsset(item)}
                  >
                    <span className="ai-chat-ticker-symbol">{item.ticker}</span>
                    <span className="ai-chat-ticker-name">{item.name}</span>
                    <span className="ai-chat-ticker-badge">{item.type}</span>
                  </button>
                ))}
              </div>
            )}

            {asset && (
              <div className="ai-chat-selected-ticker">
                <span className="ai-chat-selected-chip">
                  {asset.ticker} · {asset.name}
                </span>

                <button className="ai-chat-clear-ticker" onClick={removeAsset}>
                  quitar
                </button>
              </div>
            )}
          </div>

          <div className="ai-chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`ai-msg ${msg.role}`}>
                {msg.role === "bot" && (
                  <div className="ai-msg-avatar">AI</div>
                )}

                <div className="ai-msg-bubble">{msg.text}</div>
              </div>
            ))}

            {loading && (
              <div className="ai-msg bot">
                <div className="ai-msg-avatar">AI</div>
                <div className="ai-msg-bubble">
                  <div className="ai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form className="ai-chat-form" onSubmit={sendMessage}>
            <textarea
              className="ai-chat-input"
              placeholder={asset ? `Pregunta sobre ${asset.ticker}` : "Escribe tu pregunta"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              disabled={loading}
            />

            <button
              type="submit"
              className="ai-chat-send"
              disabled={!input.trim() || loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M568.4 37.7C578.2 34.2 589 36.7 596.4 44C603.8 51.3 606.2 62.2 602.7 72L424.7 568.9C419.7 582.8 406.6 592 391.9 592C377.7 592 364.9 583.4 359.6 570.3L295.4 412.3C290.9 401.3 292.9 388.7 300.6 379.7L395.1 267.3C400.2 261.2 399.8 252.3 394.2 246.7C388.6 241.1 379.6 240.7 373.6 245.8L261.2 340.1C252.1 347.7 239.6 349.7 228.6 345.3L70.1 280.8C57 275.5 48.4 262.7 48.4 248.5C48.4 233.8 57.6 220.7 71.5 215.7L568.4 37.7z"/></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}