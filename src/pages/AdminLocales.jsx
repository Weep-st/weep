import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminLocales = () => {
    const [locales, setLocales] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadLocales = async () => {
        setLoading(true);
        try {
            const data = await api.adminGetLocales();
            // Sort: Aceptado -> Pendiente -> Rechazado
            const sorted = data.sort((a, b) => {
                const order = { 'Aceptado': 1, 'Pendiente': 2, 'Rechazado': 3 };
                return (order[a.admin_status] || 4) - (order[b.admin_status] || 4);
            });
            setLocales(sorted);
        } catch (err) {
            toast.error('Error al cargar locales');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLocales();
    }, []);

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.adminUpdateLocalStatus(id, status);
            toast.success(`Local ${status}`);
            loadLocales();
        } catch (err) {
            toast.error('Error al actualizar estado');
        }
    };

    if (loading) return <div className="loading-state">Cargando locales...</div>;

    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header">
                <h2>Locales Registrados</h2>
                <button className="btn btn-primary" onClick={loadLocales}>Refrescar</button>
            </header>
            <div className="table-responsive">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Dirección</th>
                            <th>Estado Admin</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {locales.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No hay locales registrados.</td></tr>
                        ) : (
                            locales.map(local => (
                                <tr key={local.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <img 
                                                src={local.foto_url || 'https://placehold.co/40x40'} 
                                                alt="" 
                                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
                                            />
                                            {local.nombre}
                                        </div>
                                    </td>
                                    <td>{local.email}</td>
                                    <td>{local.direccion}</td>
                                    <td>
                                        <span className={`badge ${local.admin_status?.toLowerCase()}`}>
                                            {local.admin_status || 'Pendiente'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button 
                                                className="btn btn-success btn-sm" 
                                                onClick={() => handleUpdateStatus(local.id, 'Aceptado')}
                                                disabled={local.admin_status === 'Aceptado'}
                                            >
                                                Aceptar
                                            </button>
                                            <button 
                                                className="btn btn-danger btn-sm" 
                                                onClick={() => handleUpdateStatus(local.id, 'Rechazado')}
                                                disabled={local.admin_status === 'Rechazado'}
                                            >
                                                Rechazar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminLocales;
