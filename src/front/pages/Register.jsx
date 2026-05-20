import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/Register.css";

const EyeOpen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeClosed = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

function getStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function StrengthIndicator({ password }) {
  const score = getStrength(password);
  if (!password) return null;

  const labels = ["", "Débil", "Regular", "Buena", "Fuerte"];
  const barClass = score <= 1 ? "weak" : score <= 2 ? "medium" : "strong";

  return (
    <>
      <div className="register-strength">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`register-strength-bar${i <= score ? ` ${barClass}` : ""}`}
          />
        ))}
      </div>
      <span className="register-strength-label">{labels[score]}</span>
    </>
  );
}

export function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

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
    if (!form.confirmPassword) {
      e.confirmPassword = "Confirma tu contraseña.";
    } else if (form.password !== form.confirmPassword) {
      e.confirmPassword = "Las contraseñas no coinciden.";
    }
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, password: form.password }),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        setServerError(data.message || "Error al crear la cuenta.");
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);

    } catch {
      setServerError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">

        {/* Brand */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <div className="register-brand-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 12L6 7L9.5 10L13 4" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="13" cy="4" r="1.2" fill="#ffffff" />
            </svg>
          </div>
          <p className="register-brand-name">ECONOMOS</p>
        </div>

        <p className="register-heading">Crea tu cuenta</p>
        <p className="register-subheading">Accede a mercados en tiempo real y gestiona tus bancos</p>

        {/* Éxito */}
        {success && (
          <div className="register-success" role="status">
            ✓ Cuenta creada correctamente. Redirigiendo al login…
          </div>
        )}

        {/* Error servidor */}
        {serverError && (
          <div className="register-server-error" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* Email */}
          <div className="mb-3">
            <label htmlFor="email" className="register-label">Correo electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="tu@correo.com"
              className={`form-control register-input${errors.email ? " is-invalid" : ""}`}
              disabled={success}
            />
            {errors.email && <span className="register-field-error">{errors.email}</span>}
          </div>

          {/* Contraseña */}
          <div className="mb-3">
            <label htmlFor="password" className="register-label">Contraseña</label>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                placeholder="Mínimo 6 caracteres"
                className={`form-control register-input register-input-group${errors.password ? " is-invalid" : ""}`}
                disabled={success}
              />
              <button
                type="button"
                className="register-eye-btn"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                {showPassword ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
            {errors.password && <span className="register-field-error">{errors.password}</span>}
            <StrengthIndicator password={form.password} />
          </div>

          {/* Confirmar contraseña */}
          <div className="mb-3">
            <label htmlFor="confirmPassword" className="register-label">Confirmar contraseña</label>
            <div className="input-group">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repite tu contraseña"
                className={`form-control register-input register-input-group${errors.confirmPassword ? " is-invalid" : ""}`}
                disabled={success}
              />
              <button
                type="button"
                className="register-eye-btn"
                onClick={() => setShowConfirm((s) => !s)}
                aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                tabIndex={-1}
              >
                {showConfirm ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="register-field-error">{errors.confirmPassword}</span>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || success}
            className="register-submit-btn"
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Creando cuenta…
              </>
            ) : (
              "Crear cuenta"
            )}
          </button>

        </form>

        <p className="register-terms">
          Al registrarte aceptas nuestros{" "}
          <Link to="/terms">Términos de uso</Link>
          {" "}y{" "}
          <Link to="/privacy">Política de privacidad</Link>.
        </p>

        <p className="register-footer">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>

      </div>
    </div>
  );
}