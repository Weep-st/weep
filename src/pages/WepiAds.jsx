import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../services/api';
import './WepiAds.css';

const CATEGORIES = [
  { id: 'Todos', label: '✨ Todos' },
  { id: 'Alquileres', label: '🏢 Alquileres' },
  { id: 'Ventas Inmobiliarias', label: '🏠 Ventas' },
  { id: 'Vehículos', label: '🚗 Vehículos' },
  { id: 'Servicios', label: '🛠️ Servicios' },
  { id: 'Empleos y Búsquedas', label: '💼 Empleos' },
  { id: 'Productos y Compra/Venta', label: '📦 Productos' },
  { id: 'Eventos y Cursos', label: '📅 Eventos' },
  { id: 'Otros', label: '✨ Otros' }
];

const CATEGORY_EMOJIS = {
  'Alquileres': '🏢',
  'Ventas Inmobiliarias': '🏠',
  'Vehículos': '🚗',
  'Servicios': '🛠️',
  'Empleos y Búsquedas': '💼',
  'Productos y Compra/Venta': '📦',
  'Eventos y Cursos': '📅',
  'Otros': '✨'
};

const getCategoryEmoji = (cat) => CATEGORY_EMOJIS[cat] || '✨';

// Componente para el carrusel de imágenes individuales de cada anuncio
function AdCarousel({ images, title }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  if (!images || images.length === 0) {
    return (
      <div className="ad-image-placeholder">
        <span className="placeholder-icon">📢</span>
        <span>Sin imágenes disponibles</span>
      </div>
    );
  }

  const nextSlide = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToSlide = (idx, e) => {
    e.stopPropagation();
    setCurrentIndex(idx);
  };

  // Manejo de gestos táctiles (Swipe) para dispositivos móviles
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    } else if (isRightSwipe) {
      setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div 
      className="ad-carousel"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="ad-carousel-inner"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((imgUrl, i) => (
          <div key={i} className="ad-slide">
            <img src={imgUrl} alt={`${title} - foto ${i + 1}`} loading="lazy" />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button 
            type="button" 
            className="carousel-btn prev" 
            onClick={prevSlide}
            aria-label="Imagen anterior"
          >
            ‹
          </button>
          <button 
            type="button" 
            className="carousel-btn next" 
            onClick={nextSlide}
            aria-label="Imagen siguiente"
          >
            ›
          </button>

          <div className="carousel-dots">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`carousel-dot ${currentIndex === i ? 'active' : ''}`}
                onClick={(e) => goToSlide(i, e)}
                aria-label={`Ir a la imagen ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function WepiAds() {
  const [ads, setAds] = useState([]);
  const [filteredAds, setFilteredAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  useEffect(() => {
    async function loadAds() {
      try {
        const data = await api.getAds();
        setAds(data);
        setFilteredAds(data);
      } catch (err) {
        console.error('Error al cargar Wepi Ads:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAds();
  }, []);

  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    let filtered = ads;

    if (selectedCategory !== 'Todos') {
      filtered = filtered.filter(ad => ad.categoria === selectedCategory);
    }

    if (query) {
      filtered = filtered.filter(
        (ad) =>
          (ad.titulo && ad.titulo.toLowerCase().includes(query)) ||
          (ad.descripcion && ad.descripcion.toLowerCase().includes(query)) ||
          (ad.ubicacion && ad.ubicacion.toLowerCase().includes(query)) ||
          (ad.categoria && ad.categoria.toLowerCase().includes(query))
      );
    }
    setFilteredAds(filtered);
  }, [searchQuery, selectedCategory, ads]);

  const toggleDescription = (id) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getContactLink = (url) => {
    if (!url) return '#';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    // Si parece solo un número de teléfono, armar enlace de WhatsApp
    const cleanPhone = trimmed.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=Hola!%20Vi%20tu%20anuncio%20en%20Wepi%20Ads%20y%20me%20gustar%C3%ADa%20m%C3%A1s%20informaci%C3%B3n.`;
  };

  return (
    <div className="wepi-ads-container">
      {/* Header Premium */}
      <header className="ads-header">
        <div className="ads-header-content">
          <Link to="/" className="back-btn" aria-label="Volver al inicio">
            ← Volver
          </Link>
          <div className="header-brand">
            <img 
              src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" 
              alt="Wepi Logo" 
              className="ads-brand-logo"
            />
            <span className="ads-brand-badge">Ads</span>
          </div>
        </div>
      </header>

      {/* Hero Banner Area */}
      <section className="ads-hero animate-fade-in">
        <div className="hero-content">
          <h1>Anuncios y Clasificados</h1>
          <p>Encontrá alquileres, servicios, productos y más en Santo Tomé</p>
        </div>
      </section>

      {/* Buscador */}
      <div className="ads-search-container animate-fade-in animate-delay-1">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            id="ads-search-input"
            className="ads-search-input"
            placeholder="Buscar por título, descripción o ubicación..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              type="button" 
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Categorías (Filtros de píldoras deslizantes) */}
      <div className="ads-categories-filter animate-fade-in animate-delay-1">
        <div className="categories-scroll-wrapper">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`category-filter-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listado de Anuncios */}
      <main className="ads-main-content">
        {loading ? (
          <div className="ads-loading-state">
            <div className="spinner"></div>
            <p>Cargando anuncios...</p>
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="ads-empty-state animate-fade-in">
            <span className="empty-icon">📢</span>
            <h3>No se encontraron anuncios</h3>
            <p>Intentá con otra búsqueda o vuelve a consultar más tarde.</p>
          </div>
        ) : (
          <div className="ads-grid">
            {filteredAds.map((ad, index) => {
              const isLongDesc = ad.descripcion && ad.descripcion.length > 150;
              const isExpanded = expandedDescriptions[ad.id];
              const displayDesc = isLongDesc && !isExpanded 
                ? `${ad.descripcion.substring(0, 150)}...` 
                : ad.descripcion;

              return (
                <article 
                  key={ad.id} 
                  className="ad-card animate-fade-in"
                  style={{ animationDelay: `${0.05 * (index % 10)}s` }}
                >
                  {/* Carrusel de Imágenes */}
                  <AdCarousel images={ad.imagenes} title={ad.titulo} />

                  {/* Cuerpo de la Tarjeta */}
                  <div className="ad-card-body">
                    <div className="ad-card-tags">
                      {ad.categoria && (
                        <span className="ad-tag category-tag">
                          {getCategoryEmoji(ad.categoria)} {ad.categoria}
                        </span>
                      )}
                      {ad.precio && (
                        <span className="ad-tag price-tag">
                          {ad.precio}
                        </span>
                      )}
                      {ad.ubicacion && (
                        <span className="ad-tag location-tag">
                          📍 {ad.ubicacion}
                        </span>
                      )}
                    </div>

                    <h2 className="ad-card-title">{ad.titulo}</h2>
                    
                    <p className="ad-card-description">
                      {displayDesc}
                      {isLongDesc && (
                        <button
                          type="button"
                          className="read-more-btn"
                          onClick={() => toggleDescription(ad.id)}
                        >
                          {isExpanded ? ' Leer menos' : ' Leer más'}
                        </button>
                      )}
                    </p>

                    <div className="ad-card-footer">
                      <a 
                        href={getContactLink(ad.contacto_url)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ad-contact-btn"
                        id={`contact-ad-${ad.id}`}
                      >
                        <svg 
                          className="whatsapp-icon" 
                          viewBox="0 0 24 24" 
                          width="20" 
                          height="20"
                        >
                          <path 
                            fill="currentColor" 
                            d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.59 2.01 14.12 1.01 11.487 1.01c-5.43 0-9.855 4.37-9.858 9.802 0 1.748.475 3.4 1.378 4.886L1.935 21.93l6.3-1.654L6.647 19.154zm12.862-4.757c-.104-.173-.382-.277-.8-.485s-2.46-1.214-2.841-1.353-.658-.208-.935.208-.104.832-.416 1.178-.624.382-.9-.173-1.393-.513-2.653-1.636c-.98-.874-1.64-1.953-1.831-2.28-.192-.328-.02-.505.146-.67.148-.148.382-.45.572-.675.19-.225.253-.381.381-.635s.064-.485-.032-.693c-.095-.208-.832-2.007-1.14-2.75-.3-.722-.605-.624-.832-.635-.213-.01-.457-.012-.7-.012s-.637.092-.97.45c-.333.358-1.272 1.244-1.272 3.033 0 1.79 1.302 3.515 1.483 3.757.182.243 2.563 3.913 6.208 5.486.867.374 1.543.597 2.071.765.87.276 1.663.237 2.29.144.698-.104 2.46-.998 2.805-1.968.347-.97.347-1.802.243-1.975z"
                          />
                        </svg>
                        {ad.contacto_texto || 'Contactar por WhatsApp'}
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
