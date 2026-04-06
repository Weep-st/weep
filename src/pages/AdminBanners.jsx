import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminBanners = () => {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const loadBanners = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetBanners();
            setBanners(data);
        } catch (err) {
            toast.error('Error al cargar banners');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadBanners();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const file = fd.get('imagen');
        const link = fd.get('link');
        const activo = fd.get('activo') === 'on';
        const posicion = parseInt(fd.get('posicion')) || 0;

        setIsSaving(true);
        try {
            let imagen_url = editingBanner?.imagen_url || '';
            if (file && file.size > 0) {
                imagen_url = await api.uploadImage(file);
            }

            if (!imagen_url) {
                toast.error('La imagen es obligatoria');
                setIsSaving(false);
                return;
            }

            const payload = { imagen_url, link, activo, posicion };

            if (editingBanner) {
                await api.adminUpdateBanner(editingBanner.id, payload);
                toast.success('Banner actualizado');
            } else {
                await api.adminAddBanner(payload);
                toast.success('Banner creado');
            }

            setShowAddModal(false);
            setEditingBanner(null);
            loadBanners();
        } catch (err) {
            toast.error('Error al guardar banner');
        }
        setIsSaving(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este banner?')) return;
        try {
            await api.adminDeleteBanner(id);
            toast.success('Banner eliminado');
            loadBanners();
        } catch (err) {
            toast.error('Error al eliminar');
        }
    };

    return (
        <div className="admin-banners">
            <div className="admin-section-header">
                <h2>Gestión de Banners (Carousel)</h2>
                <button className="btn btn-primary" onClick={() => { setEditingBanner(null); setShowAddModal(true); }}>
                    + Nuevo Banner
                </button>
            </div>

            {loading ? (
                <div className="loading-state">Cargando banners...</div>
            ) : banners.length === 0 ? (
                <div className="empty-state">No hay banners configurados</div>
            ) : (
                <div className="banners-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    {banners.map(b => (
                        <div key={b.id} className="card banner-card" style={{ overflow: 'hidden' }}>
                            <img src={b.imagen_url} alt="Banner" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                            <div className="card-body" style={{ padding: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <span className={`badge ${b.activo ? 'badge-green' : 'badge-gray'}`}>
                                        {b.activo ? 'Activo' : 'Inactivo'}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Posición: {b.posicion}</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    Link: {b.link || 'Sin link'}
                                </p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingBanner(b); setShowAddModal(true); }}>
                                        Editar
                                    </button>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(b.id)}>
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content card animate-fade-in" style={{ maxWidth: '500px', width: '90%', padding: '25px' }} onClick={e => e.stopPropagation()}>
                        <h3>{editingBanner ? 'Editar Banner' : 'Añadir Banner'}</h3>
                        <form onSubmit={handleSubmit} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '5px' }}>Imagen del Banner</label>
                                {editingBanner && <img src={editingBanner.imagen_url} alt="Current" style={{ width: '100%', borderRadius: '8px', marginBottom: '10px' }} />}
                                <input type="file" name="imagen" accept="image/*" className="form-input" />
                            </div>
                            
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '5px' }}>Link de Redirección (opcional)</label>
                                <input name="link" type="text" className="form-input" placeholder="https://..." defaultValue={editingBanner?.link || ''} />
                            </div>

                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '5px' }}>Posición (Orden)</label>
                                    <input name="posicion" type="number" className="form-input" defaultValue={editingBanner?.posicion || 0} />
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '20px' }}>
                                    <input type="checkbox" name="activo" defaultChecked={editingBanner ? editingBanner.activo : true} />
                                    <span>Activo</span>
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={isSaving}>
                                    {isSaving ? 'Guardando...' : 'Guardar Banner'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminBanners;
