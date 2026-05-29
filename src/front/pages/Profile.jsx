import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import "../styles/Profile.css";

const BASE = import.meta.env.VITE_BACKEND_URL;

export function Profile() {
  const navigate = useNavigate();
  const token    = localStorage.getItem("token");

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState("");
  const [error,   setError]   = useState("");


  const [form, setForm] = useState({
    full_name:  "",
    company:    "",
    avatar_url: "",
  });

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (!token) { navigate("/login"); return; }

    const fetchProfile = async () => {
      try {
        const res  = await fetch(`${BASE}/api/profile`, { headers });
        if (res.status === 401) { navigate("/login"); return; }
        const data = await res.json();
        setProfile(data);
        setForm({
          full_name:  data.full_name  ?? "",
          company:    data.company    ?? "",
          avatar_url: "",
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSuccess("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    try {
      const res  = await fetch(`${BASE}/api/profile`, {
        method:  "PUT",
        headers,
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al guardar los cambios.");
        return;
      }

      setProfile(data.user);
      setSuccess("Perfil actualizado correctamente.");
      setForm((prev) => ({ ...prev, avatar_url: "" }));
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const initial  = profile?.email?.[0]?.toUpperCase() ?? "U";
  const username = form.full_name || profile?.email?.split("@")[0] || "Usuario";

  return (
    <div className="profile-page">
      <Sidebar
        email={profile?.email ?? ""}
        fullName={profile?.full_name ?? ""}
        avatarUrl={profile?.avatar_url ?? ""}
      />

      <div className="profile-main">

        <header className="profile-topbar">
          <h2>Mi perfil</h2>
          <p>Gestiona tu información personal</p>
        </header>

        <main className="profile-content">
          {loading ? (
            <div className="profile-loading">
              <span className="spinner-border spinner-border-sm" role="status" />
              Cargando perfil…
            </div>
          ) : (
            <>
              {success && <div className="profile-success">✓ {success}</div>}
              {error   && <div className="profile-error">{error}</div>}

              <div className="profile-grid">
                <div className="profile-card profile-avatar-card">
                  {(form.avatar_url || profile?.avatar_url) ? (
                    <img
                      src={form.avatar_url || profile?.avatar_url}
                      alt={username}
                      className="profile-avatar-img"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    ) : (
                    <div className="profile-avatar-placeholder">{initial}</div>
                  )}
                  <p className="profile-avatar-name">
                    {form.full_name || "Sin nombre"}
                  </p>
                  {form.company && (
                    <p className="profile-avatar-company">{form.company}</p>
                  )}
                  <p className="profile-avatar-email">{profile?.email}</p>
                </div>

                <div className="profile-card">
                  <div className="profile-card-title">Cuenta</div>
                  <div className="profile-info-row">
                    <span className="profile-info-label">Correo</span>
                    <span className="profile-info-value">{profile?.email}</span>
                  </div>
                  <div className="profile-info-row">
                    <span className="profile-info-label">Estado</span>
                    <span className={`profile-status-badge ${profile?.is_active ? "status-active" : "status-inactive"}`}>
                      {profile?.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className="profile-info-row">
                    <span className="profile-info-label">Favoritos</span>
                    <span className="profile-info-value">
                      {profile?.favorites?.length ?? 0} activos
                    </span>
                  </div>
                </div>


                <div className="profile-card profile-grid-full">
                  <div className="profile-card-title">Información personal</div>
                  <form onSubmit={handleSubmit} noValidate>
                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <label className="profile-label" htmlFor="full_name">
                          Nombre completo
                        </label>
                        <input
                          id="full_name"
                          name="full_name"
                          type="text"
                          value={form.full_name}
                          onChange={handleChange}
                          placeholder="Tu nombre y apellidos"
                          className="form-control profile-input"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="profile-label" htmlFor="company">
                          Empresa / Centro de estudios
                        </label>
                        <input
                          id="company"
                          name="company"
                          type="text"
                          value={form.company}
                          onChange={handleChange}
                          placeholder="Empresa o institución"
                          className="form-control profile-input"
                        />
                      </div>
                    </div>
                      <div className="mb-4">
                        <label className="profile-label" htmlFor="avatar_url">
                          URL de foto de perfil
                        </label>
                        <input
                          id="avatar_url"
                          name="avatar_url"
                          type="url"
                          value={form.avatar_url}
                          onChange={handleChange}
                          placeholder="Introduce tu URL aquí"
                          className="form-control profile-input"
                        />
                      </div>
                    <button type="submit" disabled={saving} className="profile-save-btn">
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                          Guardando…
                        </>
                      ) : (
                        "Guardar cambios"
                      )}
                    </button>
                  </form>
                </div>

              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}