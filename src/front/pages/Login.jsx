import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Login.css";

export function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const validate = () => {
    const e = {};
    if (!form.email.trim()) {
      e.email = "El correo es obligatorio.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = "Introduce un correo válido.";
    }
    if (!form.password) {
      e.password = "La contraseña es obligatoria.";
    } else if (form.password.length < 6) {
      e.password = "Mínimo 6 caracteres.";
    }
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setAuthError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        setAuthError(data.message || "Credenciales incorrectas.");
        return;
      }

      localStorage.setItem("token", data.token);
      navigate("/dashboard");

    } catch {
      setAuthError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="d-flex align-items-center gap-2 mb-4">
          <div className="login-brand-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 12L6 7L9.5 10L13 4" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="13" cy="4" r="1.2" fill="#ffffff" />
            </svg>
          </div>
          <p className="login-brand-name">ECONOMOS</p>
        </div>

        <p className="login-heading">Bienvenido de vuelta</p>
        <p className="login-subheading">Mercados en tiempo real </p>

        {authError && (
          <div className="login-auth-error" role="alert">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          <div className="mb-3">
            <label htmlFor="email" className="login-label">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="tu@correo.com"
              className={`form-control login-input${errors.email ? " is-invalid" : ""}`}
            />
            {errors.email && <span className="login-field-error">{errors.email}</span>}
          </div>

          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label htmlFor="password" className="login-label mb-0">Contraseña</label>
              <Link to="/forgot-password" className="login-forgot">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`form-control login-input login-input-group${errors.password ? " is-invalid" : ""}`}
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <span className="login-field-error">{errors.password}</span>}
          </div>


          <button type="submit" disabled={loading} className="login-submit-btn">
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Verificando…
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>

        </form>


        <p className="login-footer">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>

      </div>
    </div>
  );
}