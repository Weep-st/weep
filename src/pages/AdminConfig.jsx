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
            await api.updateConfiguracion({ 
                valor_envio: Number(config.valor_envio),
                mantenimiento_pedir: config.mantenimiento_pedir,
                mantenimiento_locales: config.mantenimiento_locales,
                mantenimiento_repartidores: config.mantenimiento_repartidores
            });
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

                <div className="maintenance-section" style={{ marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'white' }}>Mantenimiento de Páginas</h3>
                    
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        <div className="toggle-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '400px' }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1rem' }}>Página de Clientes (/pedir)</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Bloquea el acceso a la app de pedidos</p>
                            </div>
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    checked={config.mantenimiento_pedir || false}
                                    onChange={(e) => setConfig({ ...config, mantenimiento_pedir: e.target.checked })}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="toggle-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '400px' }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1rem' }}>Página de Locales (/locales)</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Bloquea el acceso al dashboard de comercios</p>
                            </div>
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    checked={config.mantenimiento_locales || false}
                                    onChange={(e) => setConfig({ ...config, mantenimiento_locales: e.target.checked })}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="toggle-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '400px' }}>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '1rem' }}>Página de Repartidores (/repartidores)</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Bloquea el acceso al panel de drivers</p>
                            </div>
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    checked={config.mantenimiento_repartidores || false}
                                    onChange={(e) => setConfig({ ...config, mantenimiento_repartidores: e.target.checked })}
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '3rem' }}>
                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        disabled={saving}
                        style={{ padding: '0.75rem 2rem' }}
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </form>


            <style>{`
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

                /* Switch Styles */
                /* The switch - the box around the slider */
                .switch {
                  position: relative;
                  display: inline-block;
                  width: 50px;
                  height: 24px;
                }

                /* Hide default HTML checkbox */
                .switch input {
                  opacity: 0;
                  width: 0;
                  height: 0;
                }

                /* The slider */
                .slider {
                  position: absolute;
                  cursor: pointer;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background-color: rgba(255,255,255,0.1);
                  -webkit-transition: .4s;
                  transition: .4s;
                  border: 1px solid var(--border-color);
                }

                .slider:before {
                  position: absolute;
                  content: "";
                  height: 16px;
                  width: 16px;
                  left: 3px;
                  bottom: 3px;
                  background-color: white;
                  -webkit-transition: .4s;
                  transition: .4s;
                }

                input:checked + .slider {
                  background-color: var(--accent-color);
                  border-color: var(--accent-color);
                }

                input:focus + .slider {
                  box-shadow: 0 0 1px var(--accent-color);
                }

                input:checked + .slider:before {
                  -webkit-transform: translateX(26px);
                  -ms-transform: translateX(26px);
                  transform: translateX(26px);
                }

                /* Rounded sliders */
                .slider.round {
                  border-radius: 24px;
                }

                .slider.round:before {
                  border-radius: 50%;
                }
            `}</style>
        </div>
    );
};

export default AdminConfig;
