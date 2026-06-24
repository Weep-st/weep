import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminConfig = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        valor_envio: 2000,
        valor_envio_shops: 2000,
        codigo_acceso: ''
    });
    const [ciudades, setCiudades] = useState([]);
    const [partners, setPartners] = useState([]);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await api.getConfiguracion();
                setConfig(data);
                const citiesData = await api.getCiudadesConfig();
                setCiudades(citiesData);
                const partnersData = await api.getPartners();
                setPartners(partnersData);
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
                valor_envio_shops: Number(config.valor_envio_shops),
                mantenimiento_pedir: config.mantenimiento_pedir,
                mantenimiento_locales: config.mantenimiento_locales,
                mantenimiento_repartidores: config.mantenimiento_repartidores,
                codigo_acceso: config.codigo_acceso
            });
            for (const c of ciudades) {
                await api.updateCityLogisticsConfig(c.ciudad, c.tipo_logistica, c.partner_oficial_id);
            }
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
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                    <div className="form-group" style={{ flex: '1', minWidth: '280px', maxWidth: '400px', marginBottom: 0 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                            Valor de Envío para Delivery (/pedir) ($)
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
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                            Este valor se aplicará a todos los pedidos con envío en la plataforma de Delivery.
                        </p>
                    </div>

                    <div className="form-group" style={{ flex: '1', minWidth: '280px', maxWidth: '400px', marginBottom: 0 }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                            Valor de Envío para Shops (/shops) ($)
                        </label>
                        <input
                            type="number"
                            value={config.valor_envio_shops !== undefined ? config.valor_envio_shops : 2000}
                            onChange={(e) => setConfig({ ...config, valor_envio_shops: e.target.value })}
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
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: 0 }}>
                            Este valor se aplicará a todos los pedidos con envío en la plataforma de Shops.
                        </p>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '2rem', maxWidth: '400px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                        Código de Acceso para Registro de Locales
                    </label>
                    <input
                        type="text"
                        value={config.codigo_acceso || ''}
                        onChange={(e) => setConfig({ ...config, codigo_acceso: e.target.value })}
                        className="admin-input"
                        placeholder="Ej: WEPI123"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.5rem',
                            color: 'white',
                            fontSize: '1rem'
                        }}
                    />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Este código será requerido a los nuevos locales para poder completar el registro.
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

                <div className="maintenance-section" style={{ marginTop: '3rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', color: 'white' }}>Logística por Ciudad</h3>
                    
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        {ciudades.map((c, idx) => (
                            <div key={c.ciudad} style={{ 
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                padding: '16px',
                                marginBottom: '16px',
                                maxWidth: '500px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: c.tipo_logistica === 'partner' ? '12px' : 0 }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>{c.ciudad}</h4>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Modalidad de distribución</p>
                                    </div>
                                    <select
                                        value={c.tipo_logistica}
                                        onChange={(e) => {
                                            const newCities = [...ciudades];
                                            newCities[idx].tipo_logistica = e.target.value;
                                            if (e.target.value !== 'partner') {
                                                newCities[idx].partner_oficial_id = null;
                                            }
                                            setCiudades(newCities);
                                        }}
                                        className="admin-input"
                                        style={{
                                            padding: '0.5rem',
                                            background: 'rgba(0,0,0,0.5)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '0.25rem',
                                            color: 'white',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        <option value="individual" style={{ background: '#222' }}>Repartidor Individual (Broadcast)</option>
                                        <option value="partner" style={{ background: '#222' }}>Partner Logístico (Empresa)</option>
                                    </select>
                                </div>

                                {c.tipo_logistica === 'partner' && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '10px' }}>
                                        <div>
                                            <span style={{ fontSize: '0.85rem', color: 'white' }}>Partner Oficial:</span>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Empresa asociada a esta ciudad</p>
                                        </div>
                                        <select
                                            value={c.partner_oficial_id || ''}
                                            onChange={(e) => {
                                                const newCities = [...ciudades];
                                                newCities[idx].partner_oficial_id = e.target.value || null;
                                                setCiudades(newCities);
                                            }}
                                            className="admin-input"
                                            style={{
                                                padding: '0.5rem',
                                                background: 'rgba(0,0,0,0.5)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '0.25rem',
                                                color: 'white',
                                                fontSize: '0.9rem'
                                            }}
                                        >
                                            <option value="" style={{ background: '#222' }}>-- Sin Asignar --</option>
                                            {partners.map(p => (
                                                <option key={p.id} value={p.id} style={{ background: '#222' }}>
                                                    {p.nombre} ({p.id}) - {p.ciudad || 'Sin Ciudad'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        ))}
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
