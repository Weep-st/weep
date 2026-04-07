import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminConfig = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        valor_envio: 2000
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await api.getConfiguracion();
                setConfig(data);
            } catch (err) {
                console.error(err);
                toast.error('Error al cargar la configuración');
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.updateConfiguracion({ valor_envio: Number(config.valor_envio) });
            toast.success('Configuración guardada correctamente');
        } catch (err) {
            console.error(err);
            toast.error('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="admin-loading">Cargando configuración...</div>;
    }

    return (
        <div className="panel-card animate-fade-in">
            <div className="panel-header">
                <h2>Configuración Global</h2>
            </div>

            <form onSubmit={handleSave} className="admin-form">
                <div className="form-group" style={{ marginBottom: '2rem', maxWidth: '400px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                        Valor de Envío ($)
                    </label>
                    <input
                        type="number"
                        value={config.valor_envio}
                        onChange={(e) => setConfig({ ...config, valor_envio: e.target.value })}
                        className="admin-input"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.5rem',
                            color: 'white',
                            fontSize: '1rem'
                        }}
                        required
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Este valor se aplicará a todos los pedidos con envío en la plataforma.
                    </p>
                </div>

                <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={saving}
                    style={{ padding: '0.75rem 2rem' }}
                >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </form>

            <style jsx>{`
                .admin-form {
                    margin-top: 1rem;
                }
                .admin-input:focus {
                    outline: none;
                    border-color: var(--accent-color);
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                }
                .admin-loading {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 200px;
                    color: var(--text-secondary);
                }
            `}</style>
        </div>
    );
};

export default AdminConfig;
