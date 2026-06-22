import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './AdminAds.css';

export default function AdminAds() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Estado del formulario actual
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formContactUrl, setFormContactUrl] = useState('');
  const [formContactText, setFormContactText] = useState('Contactar por WhatsApp');
  const [formActive, setFormActive] = useState(true);
  const [formPosition, setFormPosition] = useState(0);
  const [formCategory, setFormCategory] = useState('Otros');
  const [formImages, setFormImages] = useState([]); // Array de URLs cargadas

  const loadAds = async () => {
    setLoading(true);
    try {
      const data = await api.adminGetAds();
      setAds(data);
    } catch (err) {
      toast.error('Error al cargar publicidades');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAds();
  }, []);

  const openAddModal = () => {
    setEditingAd(null);
    setFormTitle('');
    setFormDescription('');
    setFormPrice('');
    setFormLocation('');
    setFormContactUrl('');
    setFormContactText('Contactar por WhatsApp');
    setFormActive(true);
    setFormPosition(ads.length > 0 ? Math.max(...ads.map(a => a.posicion || 0)) + 10 : 0);
    setFormCategory('Alquileres');
    setFormImages([]);
    setShowModal(true);
  };

  const openEditModal = (ad) => {
    setEditingAd(ad);
    setFormTitle(ad.titulo || '');
    setFormDescription(ad.descripcion || '');
    setFormPrice(ad.precio || '');
    setFormLocation(ad.ubicacion || '');
    setFormContactUrl(ad.contacto_url || '');
    setFormContactText(ad.contacto_texto || 'Contactar por WhatsApp');
    setFormActive(ad.activo !== false);
    setFormPosition(ad.posicion || 0);
    setFormCategory(ad.categoria || 'Otros');
    setFormImages(ad.imagenes || []);
    setShowModal(true);
  };

  // Manejo de la subida de imágenes a Cloudflare R2
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);
    const uploadedUrls = [];

    for (const file of files) {
      try {
        const url = await api.uploadImage(file);
        uploadedUrls.push(url);
      } catch (err) {
        toast.error(`Error al subir la imagen: ${file.name}`);
        console.error(err);
      }
    }

    setFormImages((prev) => [...prev, ...uploadedUrls]);
    setUploadingImages(false);
    // Limpiar el input para permitir subir los mismos archivos nuevamente si se desea
    e.target.value = '';
  };

  // Mover imagen hacia la izquierda en la lista de ordenamiento
  const moveImageLeft = (index) => {
    if (index === 0) return;
    setFormImages((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Mover imagen hacia la derecha en la lista de ordenamiento
  const moveImageRight = (index) => {
    if (index === formImages.length - 1) return;
    setFormImages((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Eliminar imagen de las cargadas temporalmente
  const removeImage = (index) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Cambiar el estado activo directamente desde la tabla principal
  const handleToggleActive = async (ad) => {
    const originalActive = ad.activo;
    const newActive = !originalActive;
    
    // Optimistic Update
    setAds((prev) =>
      prev.map((a) => (a.id === ad.id ? { ...a, activo: newActive } : a))
    );

    try {
      await api.adminUpdateAd(ad.id, { activo: newActive });
      toast.success(newActive ? 'Publicidad activada' : 'Publicidad desactivada');
    } catch (err) {
      toast.error('Error al actualizar estado');
      console.error(err);
      // Revertir en caso de fallo
      setAds((prev) =>
        prev.map((a) => (a.id === ad.id ? { ...a, activo: originalActive } : a))
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este anuncio permanentemente?')) return;
    try {
      await api.adminDeleteAd(id);
      toast.success('Anuncio eliminado con éxito');
      loadAds();
    } catch (err) {
      toast.error('Error al eliminar el anuncio');
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('El título es obligatorio');
      return;
    }

    const payload = {
      titulo: formTitle.trim(),
      descripcion: formDescription.trim(),
      precio: formPrice.trim(),
      ubicacion: formLocation.trim(),
      contacto_url: formContactUrl.trim(),
      contacto_texto: formContactText.trim(),
      activo: formActive,
      posicion: parseInt(formPosition) || 0,
      categoria: formCategory,
      imagenes: formImages,
      updated_at: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      if (editingAd) {
        await api.adminUpdateAd(editingAd.id, payload);
        toast.success('Anuncio actualizado con éxito');
      } else {
        await api.adminAddAd(payload);
        toast.success('Anuncio creado con éxito');
      }
      setShowModal(false);
      loadAds();
    } catch (err) {
      toast.error('Error al guardar el anuncio');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-ads-panel">
      <div className="admin-section-header">
        <div>
          <h2>Gestión de Wepi Ads</h2>
          <p className="section-subtitle">Administrá las publicidades que se muestran en /ads</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Nueva Publicidad
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Cargando publicidades...</div>
      ) : ads.length === 0 ? (
        <div className="empty-state">No hay publicidades registradas. Hacé clic en '+ Nueva Publicidad' para comenzar.</div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Imágenes</th>
                <th>Título</th>
                <th>Ubicación / Precio</th>
                <th>Contacto</th>
                <th>Orden</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => (
                <tr key={ad.id}>
                  <td>
                    <div className="admin-table-thumbs">
                      {ad.imagenes && ad.imagenes.length > 0 ? (
                        <img 
                          src={ad.imagenes[0]} 
                          alt={ad.titulo} 
                          className="admin-table-thumb" 
                        />
                      ) : (
                        <div className="admin-table-no-image">Sin foto</div>
                      )}
                      {ad.imagenes && ad.imagenes.length > 1 && (
                        <span className="thumb-count">+{ad.imagenes.length - 1}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="admin-ad-title-cell">
                      <strong>{ad.titulo}</strong>
                      <span className="desc-preview">
                        {ad.categoria ? `🏷️ ${ad.categoria} | ` : ''}
                        {ad.descripcion ? `${ad.descripcion.substring(0, 50)}...` : 'Sin descripción'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-ad-meta-cell">
                      <span>📍 {ad.ubicacion || 'No especificada'}</span>
                      <span className="price-badge">{ad.precio || 'Sin precio'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-ad-contact-cell">
                      <span>💬 {ad.contacto_texto}</span>
                      <span className="contact-link">{ad.contacto_url}</span>
                    </div>
                  </td>
                  <td>{ad.posicion}</td>
                  <td>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={ad.activo !== false} 
                        onChange={() => handleToggleActive(ad)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={() => openEditModal(ad)}
                      >
                        Editar
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-danger" 
                        onClick={() => handleDelete(ad.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para Crear / Editar Anuncio */}
      {showModal && (
        <div className="admin-ads-modal-overlay" onClick={() => setShowModal(false)}>
          <div 
            className="admin-ads-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{editingAd ? 'Editar Publicidad' : 'Nueva Publicidad'}</h3>
            
            <form onSubmit={handleSubmit} className="admin-ads-form">
              <div className="form-row">
                <div className="form-group flex-2">
                  <label htmlFor="ad-title">Título del Anuncio *</label>
                  <input
                    type="text"
                    id="ad-title"
                    className="form-input"
                    placeholder="Ej. Departamento 2 Ambientes en Alquiler"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label htmlFor="ad-position">Posición (Orden)</label>
                  <input
                    type="number"
                    id="ad-position"
                    className="form-input"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="ad-description">Descripción Detallada</label>
                <textarea
                  id="ad-description"
                  className="form-textarea"
                  placeholder="Detalles sobre el departamento, dimensiones, requisitos, etc."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows="4"
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="ad-category">Categoría</label>
                  <select
                    id="ad-category"
                    className="form-select"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <option value="Alquileres">🏢 Alquileres</option>
                    <option value="Ventas Inmobiliarias">🏠 Ventas Inmobiliarias</option>
                    <option value="Vehículos">🚗 Vehículos</option>
                    <option value="Servicios">🛠️ Servicios</option>
                    <option value="Empleos y Búsquedas">💼 Empleos y Búsquedas</option>
                    <option value="Productos y Compra/Venta">📦 Compra / Venta de Productos</option>
                    <option value="Eventos y Cursos">📅 Eventos y Cursos</option>
                    <option value="Otros">✨ Otros</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label htmlFor="ad-price">Precio (opcional)</label>
                  <input
                    type="text"
                    id="ad-price"
                    className="form-input"
                    placeholder="Ej. $150.000 / mes o Consultar"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                </div>
                <div className="form-group flex-1">
                  <label htmlFor="ad-location">Ubicación (opcional)</label>
                  <input
                    type="text"
                    id="ad-location"
                    className="form-input"
                    placeholder="Ej. Centro, Santo Tomé"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-2">
                  <label htmlFor="ad-contact-url">Contacto (Número Celular o Enlace) *</label>
                  <input
                    type="text"
                    id="ad-contact-url"
                    className="form-input"
                    placeholder="Ej. 3756412345 (o enlace directo)"
                    value={formContactUrl}
                    onChange={(e) => setFormContactUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex-2">
                  <label htmlFor="ad-contact-text">Texto del Botón de Contacto</label>
                  <input
                    type="text"
                    id="ad-contact-text"
                    className="form-input"
                    placeholder="Ej. Contactar por WhatsApp"
                    value={formContactText}
                    onChange={(e) => setFormContactText(e.target.value)}
                  />
                </div>
              </div>

              {/* Subida de Imágenes */}
              <div className="form-group">
                <label>Imágenes del Anuncio</label>
                <div className="image-upload-zone">
                  <input
                    type="file"
                    id="ad-images-upload"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImages}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="ad-images-upload" className="upload-zone-label">
                    {uploadingImages ? (
                      <div className="upload-spinner-container">
                        <div className="spinner-small"></div>
                        <span>Subiendo imágenes a R2...</span>
                      </div>
                    ) : (
                      <>
                        <span className="upload-icon">📸</span>
                        <span>Hacé clic para subir fotos (Podés seleccionar varias)</span>
                      </>
                    )}
                  </label>
                </div>

                {/* Previsualización de imágenes con ordenamiento y borrado */}
                {formImages.length > 0 && (
                  <div className="images-preview-gallery">
                    {formImages.map((url, idx) => (
                      <div key={idx} className="image-preview-card">
                        <img src={url} alt={`Previsualización ${idx + 1}`} />
                        
                        <button
                          type="button"
                          className="img-preview-delete"
                          onClick={() => removeImage(idx)}
                          title="Eliminar imagen"
                        >
                          ×
                        </button>
                        
                        <div className="img-preview-order-controls">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveImageLeft(idx)}
                            title="Mover a la izquierda"
                          >
                            ‹
                          </button>
                          <span className="img-idx">{idx + 1}</span>
                          <button
                            type="button"
                            disabled={idx === formImages.length - 1}
                            onClick={() => moveImageRight(idx)}
                            title="Mover a la derecha"
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                  />
                  <span className="checkbox-checkmark"></span>
                  <span className="checkbox-label">Anuncio Activo (se mostrará en la página pública)</span>
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving || uploadingImages}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving || uploadingImages}
                >
                  {isSaving ? 'Guardando...' : 'Guardar Anuncio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
