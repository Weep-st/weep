import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';
import { supabase } from '../services/supabase';

// SVG Icons to avoid using generic emojis
const CheckIcon = () => (
  <svg className="check-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
  </svg>
);

export default function Landing() {
  const [pedidos, setPedidos] = useState(0);
  const [usuarios, setUsuarios] = useState(0);
  const [animateProgress, setAnimateProgress] = useState(false);

  useEffect(() => {
    // 1. PWA Magic Redirect Fallback
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const searchParams = new URLSearchParams(window.location.search);
    const isPWAMode = searchParams.get('mode') === 'pwa';

    if (isPWA || isPWAMode) {
      const lastSection = localStorage.getItem('weep-last-section');
      if (lastSection && lastSection !== '/') {
        console.log('🚀 PWA Launch detectado. Redirigiendo a:', lastSection);
        window.location.replace(lastSection);
      }
    }

    // 2. Fetch stats and animate numbers
    let timerPedidos;
    let timerUsuarios;
    let active = true;

    const fetchStats = async () => {
      try {
        const { data: cierres, error: errorC } = await supabase
          .from('cierre_caja')
          .select('num_pedidos')
          .gte('fecha', '2026-04-01');

        const { count: countU, error: errorU } = await supabase
          .from('usuarios')
          .select('*', { count: 'exact', head: true });

        if (!active) return;

        const basePedidos = cierres ? cierres.reduce((sum, c) => sum + (c.num_pedidos || 0), 0) : 448;
        const targetPedidos = errorC ? 448 : basePedidos;
        const targetUsuarios = errorU ? 450 : (countU || 0);

        let startPedidos = 0;
        const duration = 1500; // ms
        const stepTime = 15;
        const totalSteps = Math.floor(duration / stepTime);
        const incrementPedidos = Math.ceil(targetPedidos / totalSteps) || 1;

        timerPedidos = setInterval(() => {
          startPedidos += incrementPedidos;
          if (startPedidos >= targetPedidos) {
            setPedidos(targetPedidos);
            clearInterval(timerPedidos);
          } else {
            setPedidos(startPedidos);
          }
        }, stepTime);

        let startUsuarios = 0;
        const incrementUsuarios = Math.ceil(targetUsuarios / totalSteps) || 1;

        timerUsuarios = setInterval(() => {
          startUsuarios += incrementUsuarios;
          if (startUsuarios >= targetUsuarios) {
            setUsuarios(targetUsuarios);
            clearInterval(timerUsuarios);
          } else {
            setUsuarios(startUsuarios);
          }
        }, stepTime);

      } catch (err) {
        console.error("Error fetching landing stats:", err);
        setPedidos(400);
        setUsuarios(450);
      }
    };

    fetchStats();

    // 3. Realtime subscriptions
    const channelPedidos = supabase
      .channel('landing_pedidos_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pedidos_general'
      }, () => {
        setPedidos(prev => prev + 1);
      })
      .subscribe();

    const channelUsuarios = supabase
      .channel('landing_usuarios_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'usuarios'
      }, () => {
        setUsuarios(prev => prev + 1);
      })
      .subscribe();

    // Trigger progress bar animation after a slight delay
    const progressTimeout = setTimeout(() => {
      setAnimateProgress(true);
    }, 100);

    return () => {
      active = false;
      if (timerPedidos) clearInterval(timerPedidos);
      if (timerUsuarios) clearInterval(timerUsuarios);
      supabase.removeChannel(channelPedidos);
      supabase.removeChannel(channelUsuarios);
      clearTimeout(progressTimeout);
    };
  }, []);

  return (
    <div className="landing-corporate">
      {/* 1. Header & Navigation */}
      <header className="navbar-red">
        <div className="navbar-container">
          <Link to="/" className="navbar-brand">
            <img
              src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png"
              alt="Wepi Logo"
              className="navbar-logo"
            />
          </Link>
          <nav className="navbar-menu">
            <a href="#procesos" className="nav-link">Procesos</a>
            <a href="#ecosistema" className="nav-link">Ecosistema</a>
            <a href="#expansion" className="nav-link">Expansión</a>
          </nav>
          <div className="navbar-actions">
            <Link to="/locales" className="btn-nav-secondary">Comercios</Link>
            <Link to="/repartidores" className="btn-nav-secondary">Repartidores</Link>
            <Link to="/pedir" className="btn-nav-primary">Pedir ahora</Link>
          </div>
        </div>
      </header>

      {/* 2. HERO Section */}
      <section className="hero-section">
        <div className="grid-overlay"></div>
        <div className="hero-container-split">
          <div className="hero-content">
            <h1 className="hero-title animate-fade-in animate-delay-1">
              La forma más fácil de pedir en <span>mercados regionales.</span>
            </h1>
            <p className="hero-subtitle animate-fade-in animate-delay-2">
              Conectamos clientes, comercios y logística local para que pedir, vender y entregar sea simple, rápido y desde un solo lugar.
            </p>
            <div className="hero-buttons animate-fade-in animate-delay-2">
              <Link to="/pedir" className="btn-hero-primary">
                Pedir ahora
              </Link>
              <Link to="/locales" className="btn-hero-secondary">
                Sumar comercio
              </Link>
              <Link to="/repartidores" className="btn-hero-secondary">
                Ser repartidor
              </Link>
            </div>
            {/* Quick Metrics Underneath with Dynamic Counters & Progress Bar */}
            <div className="hero-metrics-bar animate-fade-in animate-delay-2">
              <div className="metric-item-dynamic">
                <span className="metric-label">Pedidos entregados</span>
                <span className="metric-number">+{pedidos}</span>
                <div className="metric-progress-track">
                  <div className="metric-progress-bar" style={{ width: animateProgress ? '80%' : '0%' }}></div>
                </div>
              </div>
              <div className="metric-divider"></div>
              <div className="metric-item-dynamic">
                <span className="metric-label">Usuarios registrados</span>
                <span className="metric-number">+{usuarios}</span>
                <div className="metric-progress-track">
                  <div className="metric-progress-bar" style={{ width: animateProgress ? '90%' : '0%' }}></div>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-visual-mockup animate-fade-in animate-delay-1">
            <div className="mockup-screen-container">
              <img
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80"
                alt="Wepi Dashboard Mockup"
                className="mockup-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. MARCAS Y ALIANZAS */}
      <section className="brands-section">
        <div className="brands-container">
          <h3 className="section-label">MARCAS Y ALIANZAS</h3>
          <h2 className="brands-title">Franquicias y marcas líderes en la plataforma</h2>
          <div className="brands-grid">
            <div className="brand-logo-card">
              <div className="brand-img-container">
                <img src="https://i.postimg.cc/vB7vG6KK/full.png" alt="YPF Full" className="brand-logo-img" />
              </div>
              <span>YPF Full</span>
            </div>
            <div className="brand-logo-card">
              <div className="brand-img-container">
                <img src="https://i.postimg.cc/43V619Xt/images.png" alt="Puma Energy" className="brand-logo-img" />
              </div>
              <span>Puma Energy</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PROCESOS */}
      <section id="procesos" className="how-it-works-section">
        <div className="how-container">
          <div className="text-center">
            <h3 className="section-label">PROCESOS</h3>
            <h2 className="section-title">Simple y Automatizado</h2>
          </div>

          <div className="steps-grid">
            <div className="steps-column">
              <h4 className="steps-column-title">Para Usuarios</h4>
              <div className="step-card">
                <span className="step-number">1</span>
                <div>
                  <h5>Descubrí comercios</h5>
                  <p>Explorá los comercios disponibles en tu ciudad y encontrá todo lo que necesitás en un solo lugar.</p>
                </div>
              </div>
              <div className="step-card">
                <span className="step-number">2</span>
                <div>
                  <h5>Realizá tu pedido</h5>
                  <p>Elegì productos y confirmá tu compra en segundos.</p>
                </div>
              </div>
              <div className="step-card">
                <span className="step-number">3</span>
                <div>
                  <h5>Pagá de forma segura</h5>
                  <p>Completá el pago online mediante Mercado Pago y otros medios integrados.</p>
                </div>
              </div>
              <div className="step-card">
                <span className="step-number">4</span>
                <div>
                  <h5>Recibí tu compra</h5>
                  <p>Seguí el pedido en tiempo real hasta la entrega en tu domicilio.</p>
                </div>
              </div>
            </div>

            <div className="steps-column">
              <h4 className="steps-column-title">Para Comercios</h4>
              <div className="step-card accent">
                <span className="step-number">1</span>
                <div>
                  <h5>Recibí pedidos confirmados</h5>
                  <p>Los pedidos ingresan automáticamente al sistema con toda la información necesaria listo para preparar.</p>
                </div>
              </div>
              <div className="step-card accent">
                <span className="step-number">2</span>
                <div>
                  <h5>Coordinación automática</h5>
                  <p>La plataforma procesa pagos, asigna entregas y mantiene informados a clientes y repartidores.</p>
                </div>
              </div>
              <div className="step-card accent">
                <span className="step-number">3</span>
                <div>
                  <h5>Escalá tu negocio</h5>
                  <p>Atendé más pedidos con menos trabajo operativo y obtené métricas para impulsar el crecimiento.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ECOSISTEMA WEPI */}
      <section id="ecosistema" className="solutions-simple-section">
        <div className="solutions-simple-container">
          <div className="text-center">
            <h3 className="section-label">ECOSISTEMA WEPI</h3>
            <h2 className="section-title">una plataforma - 3 pilares</h2>
          </div>
          <div className="solutions-simple-grid">
            <div className="solution-card">
              <div className="solution-card-header">
                <span className="solution-bullet"></span>
                <h4>Usuarios</h4>
              </div>
              <p>Pedí en segundos desde tus comercios favoritos.</p>
              <Link to="/pedir" className="solution-link">Pedir ahora ➜</Link>
            </div>
            <div className="solution-card">
              <div className="solution-card-header">
                <span className="solution-bullet"></span>
                <h4>Comercios</h4>
              </div>
              <p>Menos operación. Más ventas.</p>
              <Link to="/locales" className="solution-link">Sumar comercio ➜</Link>
            </div>
            <div className="solution-card">
              <div className="solution-card-header">
                <span className="solution-bullet"></span>
                <h4>Logística</h4>
              </div>
              <p>Más entregas. Más oportunidades.</p>
              <Link to="/repartidores" className="solution-link">Ser repartidor ➜</Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CRECIENDO CIUDAD POR CIUDAD */}
      <section id="expansion" className="expansion-section">
        <div className="expansion-container">
          <div className="expansion-content">
            <h3 className="section-label">EXPANSIÓN</h3>
            <h2 className="section-title">Creciendo ciudad por ciudad</h2>
            <div className="cities-list">
              <div className="city-item active">
                <span className="status-dot green"></span>
                <strong>Santo Tomé</strong> (Activo desde abril 2026 · +400 pedidos entregados)
              </div>
              <div className="city-item future">
                <span className="status-dot yellow"></span>
                <strong>Oberá</strong> (A partir de julio 2026)
              </div>
              <div className="city-item future">
                <span className="status-dot yellow"></span>
                <strong>Virasoro</strong> (Próximamente)
              </div>
              <div className="city-item future">
                <span className="status-dot yellow"></span>
                <strong>Apóstoles</strong> (Próximamente)
              </div>
              <div className="city-item future">
                <span className="status-dot yellow"></span>
                <strong>Leandro N. Alem</strong> (Próximamente)
              </div>
              <div className="city-item search">
                <span className="status-dot pulse"></span>
                <strong>Nuevas ciudades</strong> (En planificación)
              </div>
            </div>
          </div>
          <div className="expansion-vision-card">
            <div className="vision-bullet-icon"><CheckIcon /></div>
            <p>Construimos infraestructura digital para ciudades medianas y pequeñas de Argentina.</p>
          </div>
        </div>
      </section>

      {/* 7. CTA FINAL */}
      <section className="cta-final-section">
        <div className="cta-final-container">
          <h2>¿Querés sumarte a la red Wepi?</h2>
          <div className="cta-buttons">
            <Link to="/locales" className="btn-cta-primary">
              Sumar comercio
            </Link>
            <a href="https://wa.me/543756543610" className="btn-cta-secondary" target="_blank" rel="noopener noreferrer">
              Hablar con nosotros
            </a>
          </div>
        </div>
      </section>

      {/* 8. Corporate Footer */}
      <footer className="corporate-footer">
        <div className="footer-container">
          <div className="footer-brand-col">
            <img
              src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png"
              alt="Wepi Logo Dark"
              className="footer-logo"
            />
            <p className="footer-tagline">
              Plataforma de pedidos y operación comercial con logística integrada.
            </p>
          </div>
          <div className="footer-links-col">
            <h5>Ecosistema</h5>
            <Link to="/pedir">Para usuarios</Link>
            <Link to="/locales">Para comercios</Link>
            <Link to="/repartidores">Para repartidores</Link>
          </div>
          <div className="footer-links-col">
            <h5>Compañía</h5>
            <a href="#procesos">Procesos</a>
            <a href="#expansion">Expansión</a>
            <span className="footer-location">Santo Tomé, Corrientes, Argentina</span>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 <strong>Wepi</strong>. Todos los derechos reservados. Infraestructura digital para ciudades del interior.</p>
        </div>
      </footer>
    </div>
  );
}
