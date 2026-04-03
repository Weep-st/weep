import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { registrarEmailLanzamiento } from '../services/api';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import './Landing.css';

const LAUNCH_DATE = new Date('2026-04-02T00:00:00-03:00').getTime();

export default function Landing() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = LAUNCH_DATE - now;
      if (diff <= 0) { setLaunched(true); return; }
      setTime({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast.error('Ingresá un email válido');
      return;
    }
    setLoading(true);
    try {
      const result = await registrarEmailLanzamiento(email);
      if (result.success) {
        setSubmitted(true);
        toast.success('¡Te avisaremos cuando lancemos! 🚀');
      } else {
        toast.error(result.message || 'No se pudo guardar tu email');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="landing">
      <header className="landing-header">
        <img
          src="https://res.cloudinary.com/dw10wkbac/image/upload/v1775234747/gvapffe3wwp4ljgr33le.png"
          alt="Weep"
          className="landing-logo"
        />
      </header>

      <main className="landing-main">
        <div className="landing-hero animate-fade-in">
          {launched ? (
            <h1 className="landing-title">¡Ya estamos en vivo!</h1>
          ) : (
            <h1 className="landing-title">Falta poco...</h1>
          )}
          <p className="landing-subtitle">
            La forma más fácil y rápida de pedir comida en Santo Tomé está llegando...
          </p>
        </div>

        {launched ? (
          <div className="landing-cta animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <Link to="/pedir" className="btn btn-primary btn-lg" style={{ fontSize: '1.2rem', padding: '18px 48px' }}>
              🍔 ¡Pedí ahora!
            </Link>
          </div>
        ) : (
          <>
            <div className="countdown animate-slide-up" style={{ animationDelay: '0.1s' }}>
              {[
                { val: time.days, label: 'Días' },
                { val: time.hours, label: 'Horas' },
                { val: time.minutes, label: 'Min' },
                { val: time.seconds, label: 'Seg' },
              ].map(({ val, label }) => (
                <div className="countdown-item" key={label}>
                  <span className="countdown-number">{pad(val)}</span>
                  <span className="countdown-label">{label}</span>
                </div>
              ))}
            </div>

            <div className="landing-form-card animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <h3>Enterate primero cuando lancemos</h3>
              <p>Dejá tu email y te avisamos el día de lanzamiento con promociones exclusivas.</p>
              {submitted ? (
                <div className="landing-success">
                  <span>✅</span> ¡Genial! Te avisaremos cuando lancemos 🚀
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="tuemail@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? <span className="spinner spinner-white" /> : 'Quiero ser notificado'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        <div className="features-grid animate-slide-up" style={{ animationDelay: '0.3s' }}>
          {[
            { icon: '⚡', title: 'Entrega rapidísima', desc: 'Los mejores tiempos de entrega, con seguimiento en tiempo real.' },
            { icon: '🍕', title: 'Más locales, más variedad', desc: 'Desde hamburgueserías hasta panaderías y empanadas caseras, todo en un solo lugar.' },
            { icon: '🎉', title: 'Envío gratis con bebida', desc: 'Agregá una bebida y olvidate del costo de envío. Simple y sin letras chicas.' },
          ].map(({ icon, title, desc }) => (
            <div className="feature-card card card-hover" key={title}>
              <div className="feature-icon">{icon}</div>
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>

        <div className="landing-links animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <Link to="/locales" className="btn btn-secondary">
            🏪 Registrá tu Local
          </Link>
          <Link to="/repartidores" className="btn btn-ghost">
            🏍️ Sé Repartidor
          </Link>
        </div>
      </main>

      <footer className="footer">
        <p>© 2026 <strong>Weep</strong> — Plataforma de Pedidos y Delivery</p>
        <p>
          <a href="mailto:bajoneando.st@gmail.com">Contacto</a> •{' '}
          <a href="#">Términos</a>
        </p>
        <div className="social-links">
          <a href="https://www.instagram.com/weep.st" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.332.014 7.052.072 2.579.267.273 2.641.072 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.411 2.506 6.785 6.979 6.98C8.332 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.411-.2 6.785-2.506 6.98-6.979.058-1.28.072-1.689.072-4.948 0-3.259-.014-3.668-.072-4.948-.2-4.411-2.506-6.785-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z"/>
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}
