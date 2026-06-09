import { useNavigate, useLocation, Link } from "react-router-dom";
import "../styles/Sidebar.css";

const IconGrid   = () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IconChart  = () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/></svg>;
const IconWallet = () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3m18 0H3"/></svg>;
const IconStar   = () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>;
const IconNews   = () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"/></svg>;
const IconUser   = () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>;
const IconLogout = () => <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15"/></svg>;

const NAV = [
  { label: "Mi cartera",   path: "/dashboard",  icon: <IconWallet /> },
  { label: "Mercados",   path: "/markets",    icon: <IconChart />, badge: "Live" },
  { label: "Favoritos",  path: "/favorites",  icon: <IconStar  /> },
  { label: "Noticias",   path: "/news",       icon: <IconNews  /> },
];


export function Sidebar({ email = "", fullName = "", avatarUrl = "" }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const initial  = email?.[0]?.toUpperCase() ?? "U";
  const username = fullName || email?.split("@")[0] || "Usuario";

  return (
    <aside className="sidebar">

      <Link to="/dashboard" className="sb-brand">
        <div className="sb-brand-mark">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 12L6 7L9.5 10L13 4" stroke="#1e2025" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="13" cy="4" r="1.2" fill="#1e2025" />
          </svg>
        </div>
        <p className="sb-brand-name">ECONOMOS</p>
      </Link>
      <hr className="sb-divider" />
      <div className="sb-section">Principal</div>

      {NAV.map(({ label, path, icon, badge }) => (
        <Link
          key={path}
          to={path}
          className={`sb-item${location.pathname === path ? " active" : ""}`}
        >
          {icon}
          {label}
          {badge && <span className="sb-badge">{badge}</span>}
        </Link>
      ))}

      <hr className="sb-divider" style={{ marginTop: 8 }} />
      <div className="sb-section">Cuenta</div>

      <Link
        to="/profile"
        className={`sb-item${location.pathname === "/profile" ? " active" : ""}`}
      >
        <IconUser />
        Perfil
      </Link>

      <div className="sb-bottom">
        <div className="sb-user">
          <div className="sb-avatar">
            {avatarUrl
              ? <img src={avatarUrl} alt={username} onError={(e) => { e.target.style.display = "none"; }} />
              : initial
            }
          </div>
          <div className="sb-user-info">
            <span className="sb-name">{username}</span>
            <span className="sb-email">{email}</span>
          </div>
        </div>
        <button className="sb-item" onClick={handleLogout}>
          <IconLogout />
          Cerrar sesión
        </button>
      </div>

    </aside>
  );
}
