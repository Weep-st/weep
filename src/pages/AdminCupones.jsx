import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminCupones = () => {
    const [cupones, setCupones] = useState([]);
    const [locales, setLocales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCupon, setEditingCupon] = useState(null);
    const [formData, setFormData] = useState({
        codigo: '',
        tipo: 'fijo',
        valor: '',
        fecha_expiracion: '',
        minimo_compra: '0',
        local_id: '',
        limite_usos: '',
        activo: true
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [cuponesData, localesData] = await Promise.all([
                api.adminGetCupones(),
                api.adminGetLocales()
            ]);
            setCupones(cuponesData);
            setLocales(localesData);
        } catch (err) {
            toast.error('Error al cargar datos');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenModal = (cupon = null) => {
        if (cupon) {
            setEditingCupon(cupon);
            setFormData({
                codigo: cupon.codigo,
                tipo: cupon.tipo,
                valor: cupon.valor.toString(),
                fecha_expiracion: cupon.fecha_expiracion ? cupon.fecha_expiracion.split('T')[0] : '',
                minimo_compra: cupon.minimo_compra.toString(),
                local_id: cupon.local_id || '',
                limite_usos: cupon.limite_usos ? cupon.limite_usos.toString() : '',
                activo: cupon.activo
            });
        } else {
            setEditingCupon(null);
            setFormData({
                codigo: '',
                tipo: 'fijo',
                valor: '',
                fecha_expiracion: '',
                minimo_compra: '0',
                local_id: '',
                limite_usos: '',
                activo: true
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = {
            ...formData,
            codigo: formData.codigo.toUpperCase().trim(),
            valor: parseFloat(formData.valor),
            minimo_compra: parseFloat(formData.minimo_compra),
            limite_usos: formData.limite_usos ? parseInt(formData.limite_usos) : null,
            local_id: formData.local_id || null,
            fecha_expiracion: formData.fecha_expiracion || null
        };

        try {
            if (editingCupon) {
                await api.adminUpdateCupon(editingCupon.id, data);
                toast.success('Cupón actualizado');
            } else {
                await api.adminCreateCupon(data);
                toast.success('Cupón creado');
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Error al guardar cupón');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este cupón?')) return;
        try {
            await api.adminDeleteCupon(id);
            toast.success('Cupón eliminado');
            loadData();
        } catch (err) {
            toast.error('Error al eliminar cupón');
        }
    };

    const toggleActivo = async (cupon) => {
        try {
            await api.adminUpdateCupon(cupon.id, { activo: !cupon.activo });
            loadData();
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    if (loading) return <div className="loading-state">Cargando cupones...</div>;

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Gestión de Cupones</h2>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    + Nuevo Cupón
                </button>
            </header>

            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Tipo</th>
                            <th>Valor</th>
                            <th>Min. Compra</th>
                            <th>Local</th>
                            <th>Vence</th>
                            <th>Usos</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cupones.length === 0 ? (
                            <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>No hay cupones creados.</td></tr>
                        ) : (
                            cupones.map(cupon => (
                                <tr key={cupon.id}>
                                    <td style={{ fontWeight: 700, color: 'var(--red-500)' }}>{cupon.codigo}</td>
                                    <td>{cupon.tipo === 'porcentaje' ? 'Porcentaje' : 'Fijo'}</td>
                                    <td>{cupon.tipo === 'porcentaje' ? `${cupon.valor}%` : `$${cupon.valor}`}</td>
                                    <td>${cupon.minimo_compra || 0}</td>
                                    <td>{cupon.local_id ? locales.find(l => l.id === cupon.local_id)?.nombre || cupon.local_id : 'Cualquiera'}</td>
                                    <td>{cupon.fecha_expiracion ? new Date(cupon.fecha_expiracion).toLocaleDateString() : 'Nunca'}</td>
                                    <td>{cupon.usos_actuales} / {cupon.limite_usos || '∞'}</td>
                                    <td>
                                        <button 
                                            className={`badge ${cupon.activo ? 'badge-success' : 'badge-danger'}`}
                                            onClick={() => toggleActivo(cupon)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {cupon.activo ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleOpenModal(cupon)}>✏️</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(cupon.id)}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-box animate-scale-in" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <header className="modal-header">
                            <h3>{editingCupon ? 'Editar Cupón' : 'Nuevo Cupón'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </header>
                        <form onSubmit={handleSubmit} className="admin-form">
                            <div className="form-group">
                                <label className="form-label">Código</label>
                                <input 
                                    className="form-input" 
                                    placeholder="EJ: BIENVENIDO10" 
                                    value={formData.codigo}
                                    onChange={e => setFormData({...formData, codigo: e.target.value})}
                                    required 
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Tipo</label>
                                    <select 
                                        className="form-select"
                                        value={formData.tipo}
                                        onChange={e => setFormData({...formData, tipo: e.target.value})}
                                    >
                                        <option value="fijo">Monto Fijo ($)</option>
                                        <option value="porcentaje">Porcentaje (%)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Valor</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        value={formData.valor}
                                        onChange={e => setFormData({...formData, valor: e.target.value})}
                                        required 
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Compra Mínima ($)</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    value={formData.minimo_compra}
                                    onChange={e => setFormData({...formData, minimo_compra: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Válido en Local (Opcional)</label>
                                <select 
                                    className="form-select"
                                    value={formData.local_id}
                                    onChange={e => setFormData({...formData, local_id: e.target.value})}
                                >
                                    <option value="">Cualquiera (Global)</option>
                                    {locales.filter(l => l.admin_status === 'Aceptado').map(local => (
                                        <option key={local.id} value={local.id}>{local.nombre}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha de Expiración</label>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    value={formData.fecha_expiracion}
                                    onChange={e => setFormData({...formData, fecha_expiracion: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Límite de Usos (Opcional)</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    placeholder="Vacío para ilimitado"
                                    value={formData.limite_usos}
                                    onChange={e => setFormData({...formData, limite_usos: e.target.value})}
                                />
                            </div>
                            <div style={{ marginTop: '2rem' }}>
                                <button type="submit" className="btn btn-primary btn-full">
                                    {editingCupon ? 'Actualizar' : 'Crear Cupón'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCupones;
