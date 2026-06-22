import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './AdminCredits.css';

const AdminCredits = () => {
    const [configs, setConfigs] = useState([]);
    const [locales, setLocales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState(null);
    const [formData, setFormData] = useState(getInitialFormState());

    function getInitialFormState() {
        return {
            local_id: null,
            activo: true,
            objetivo: 'activacion',
            porcentaje_ganancia: 10,
            tope_maximo_ganancia: 1000,
            compra_minima_generar: 5000,
            duracion_dias: 7,
            tipo_vencimiento: 'fija',
            porcentaje_maximo_uso_saldo: 50,
            max_porcentaje_pedido: 30,
            compra_minima_uso: 6000,
            uso_minimo_credito: 500,
            genera_credito_sobre_credito: false,
            porcentaje_reducido_recompra: 5,
            acumulable_promos: true,
            compatible_envio_gratis: true,
            solo_primera_compra: false,
            max_creditos_activos: null,
            max_ganancia_usuario: null,
            max_pedidos_generar: null,
            uso_local_exclusivo: false
        };
    }

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [configsData, localesData] = await Promise.all([
                api.adminGetWalletConfigs(),
                api.adminGetLocales()
            ]);
            setConfigs(configsData);
            setLocales(localesData);
        } catch (err) {
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (config = null) => {
        if (config) {
            setEditingConfig(config);
            setFormData({ ...config });
        } else {
            setEditingConfig(null);
            setFormData(getInitialFormState());
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        let finalValue = type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? null : Number(value)) : value);
        
        // Fix: local_id should be null, not "" for Global
        if (name === 'local_id' && value === '') {
            finalValue = null;
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };

    const applyObjectivePreset = (objetivo) => {
        let preset = {};
        switch (objetivo) {
            case 'activacion':
                preset = { porcentaje_ganancia: 15, duracion_dias: 5, solo_primera_compra: true, objetivo: 'activacion' };
                break;
            case 'recompra':
                preset = { porcentaje_ganancia: 10, duracion_dias: 7, genera_credito_sobre_credito: true, objetivo: 'recompra' };
                break;
            case 'ticket':
                preset = { porcentaje_ganancia: 12, compra_minima_generar: 15000, objetivo: 'ticket' };
                break;
            case 'horas_valle':
                preset = { porcentaje_ganancia: 20, objetivo: 'horas_valle' };
                break;
            default: break;
        }
        setFormData(prev => ({ ...prev, ...preset }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            console.log("Saving Wallet Config:", formData);
            await api.adminSaveWalletConfig(formData);
            toast.success(editingConfig ? 'Configuración actualizada' : 'Configuración creada');
            loadData();
            handleCloseModal();
        } catch (err) {
            console.error("Detailed Save Error:", err);
            toast.error('Error al guardar: ' + (err.details || err.message || 'Error desconocido'));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta configuración?')) return;
        try {
            await api.adminDeleteWalletConfig(id);
            toast.success('Configuración eliminada');
            loadData();
        } catch (err) {
            toast.error('Error al eliminar');
        }
    };

    return (
        <div className="admin-credits-container">
            <div className="panel-header">
                <div>
                    <h2>Configuración de Créditos (Wallet)</h2>
                    <p className="subtitle">Gestiona cómo los usuarios ganan y usan créditos por local</p>
                </div>
                <button className="btn btn-primary btn-with-icon" onClick={() => handleOpenModal()}>
                    <span className="icon">➕</span> Nueva Configuración
                </button>
            </div>

            {loading ? (
                <div className="loading-state">Cargando configuraciones...</div>
            ) : (
                <div className="configs-grid">
                    {configs.map(config => (
                        <div key={config.id} className={`config-card ${!config.activo ? 'inactive' : ''}`}>
                            <div className="card-badge">
                                {config.local_id ? 'Local Específico' : 'Global / Defecto'}
                            </div>
                            <div className="card-content">
                                <div className="card-header">
                                    <h3>{config.local_id ? locales.find(l => l.id === config.local_id)?.nombre : 'Todos los Locales'}</h3>
                                    <span className={`status-dot ${config.activo ? 'active' : ''}`}></span>
                                </div>
                                
                                <div className="stats-row">
                                    <div className="mini-stat">
                                        <label>Ganancia</label>
                                        <span>{config.porcentaje_ganancia}%</span>
                                    </div>
                                    <div className="mini-stat">
                                        <label>Tope</label>
                                        <span>${config.tope_maximo_ganancia}</span>
                                    </div>
                                    <div className="mini-stat">
                                        <label>Vence</label>
                                        <span>{config.duracion_dias}d</span>
                                    </div>
                                </div>

                                <div className="objetivo-badge">
                                    🎯 {config.objetivo?.replace('_', ' ').toUpperCase()}
                                </div>

                                <div className="card-actions">
                                    <button className="btn btn-secondary" onClick={() => handleOpenModal(config)}>Editar</button>
                                    <button className="btn btn-danger-soft" onClick={() => handleDelete(config.id)}>Eliminar</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content admin-modal large">
                        <header className="modal-header">
                            <h3>{editingConfig ? 'Editar Configuración' : 'Nueva Configuración'}</h3>
                            <button className="close-btn" onClick={handleCloseModal}>×</button>
                        </header>
                        
                        <form onSubmit={handleSubmit} className="config-form">
                            <div className="form-sections">
                                {/* SECCIÓN IZQUIERDA: GENERAL + GENERACIÓN */}
                                <div className="form-column">
                                    <section className="form-section">
                                        <h4><span className="icon">🎯</span> F) Objetivo de Campaña</h4>
                                        <div className="objective-selector">
                                            {['activacion', 'recompra', 'ticket', 'horas_valle'].map(obj => (
                                                <button 
                                                    key={obj}
                                                    type="button"
                                                    className={`obj-btn ${formData.objetivo === obj ? 'selected' : ''}`}
                                                    onClick={() => applyObjectivePreset(obj)}
                                                >
                                                    {obj.replace('_', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="form-section">
                                        <h4><span className="icon">🏨</span> Ámbito</h4>
                                        <div className="form-group">
                                            <label>Aplicar a:</label>
                                            <select name="local_id" value={formData.local_id || ''} onChange={handleInputChange}>
                                                <option value="">Global (Todos los locales sin config propia)</option>
                                                {locales.map(l => (
                                                    <option key={l.id} value={l.id}>{l.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group checkbox">
                                            <input type="checkbox" name="activo" id="activo" checked={formData.activo} onChange={handleInputChange} />
                                            <label htmlFor="activo">Configuración Activa</label>
                                        </div>
                                    </section>

                                    <section className="form-section">
                                        <h4><span className="icon">💰</span> A) Generación de Crédito</h4>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>% Ganancia</label>
                                                <input type="number" name="porcentaje_ganancia" value={formData.porcentaje_ganancia} onChange={handleInputChange} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Tope Máximo ($)</label>
                                                <input type="number" name="tope_maximo_ganancia" value={formData.tope_maximo_ganancia} onChange={handleInputChange} />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label>Compra Mínima para Generar ($)</label>
                                            <input type="number" name="compra_minima_generar" value={formData.compra_minima_generar} onChange={handleInputChange} />
                                        </div>
                                    </section>

                                    <section className="form-section">
                                        <h4><span className="icon">⏳</span> B) Validez</h4>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Duración (Días)</label>
                                                <input type="number" name="duracion_dias" value={formData.duracion_dias} onChange={handleInputChange} required />
                                            </div>
                                            <div className="form-group">
                                                <label>Tipo Vencimiento</label>
                                                <select name="tipo_vencimiento" value={formData.tipo_vencimiento} onChange={handleInputChange}>
                                                    <option value="fija">Fija (Desde la compra)</option>
                                                    <option value="dinamica">Dinámica (Al final del día X)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>
                                </div>

                                {/* SECCIÓN DERECHA: USO + RECOMPRA + RESTRICCIONES */}
                                <div className="form-column">
                                    <section className="form-section">
                                        <h4><span className="icon">🛒</span> C) Uso del Crédito</h4>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>% Máx del Saldo</label>
                                                <input type="number" name="porcentaje_maximo_uso_saldo" value={formData.porcentaje_maximo_uso_saldo} onChange={handleInputChange} min="1" max="100" />
                                            </div>
                                            <div className="form-group">
                                                <label>% Máx del Pedido</label>
                                                <input type="number" name="max_porcentaje_pedido" value={formData.max_porcentaje_pedido} onChange={handleInputChange} min="1" max="100" />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Compra Mínima ($)</label>
                                                <input type="number" name="compra_minima_uso" value={formData.compra_minima_uso} onChange={handleInputChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Uso Mínimo ($)</label>
                                                <input type="number" name="uso_minimo_credito" value={formData.uso_minimo_credito} onChange={handleInputChange} />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="form-section">
                                        <h4><span className="icon">🔁</span> D) Recompra / Loop</h4>
                                        <div className="form-group checkbox">
                                            <input type="checkbox" name="genera_credito_sobre_credito" id="genera_lp" checked={formData.genera_credito_sobre_credito} onChange={handleInputChange} />
                                            <label htmlFor="genera_lp">¿Genera nuevo crédito si usa crédito?</label>
                                        </div>
                                        {formData.genera_credito_sobre_credito && (
                                            <div className="form-group">
                                                <label>% Reducido para Recompra</label>
                                                <input type="number" name="porcentaje_reducido_recompra" value={formData.porcentaje_reducido_recompra} onChange={handleInputChange} />
                                                <small>Si usa saldo, gana este % en lugar del normal</small>
                                            </div>
                                        )}
                                    </section>

                                    <section className="form-section">
                                        <h4><span className="icon">🔒</span> E) Restricciones</h4>
                                        <div className="checkbox-grid">
                                            <div className="form-group checkbox">
                                                <input type="checkbox" name="acumulable_promos" id="ac_promos" checked={formData.acumulable_promos} onChange={handleInputChange} />
                                                <label htmlFor="ac_promos">Acumulable con Promos</label>
                                            </div>
                                            <div className="form-group checkbox">
                                                <input type="checkbox" name="compatible_envio_gratis" id="env_gratis" checked={formData.compatible_envio_gratis} onChange={handleInputChange} />
                                                <label htmlFor="env_gratis">Compatible con Envío Gratis</label>
                                            </div>
                                            <div className="form-group checkbox">
                                                <input type="checkbox" name="solo_primera_compra" id="first_buy" checked={formData.solo_primera_compra} onChange={handleInputChange} />
                                                <label htmlFor="first_buy">Solo Primera Compra</label>
                                            </div>
                                            <div className="form-group checkbox">
                                                <input type="checkbox" name="uso_local_exclusivo" id="uso_local" checked={formData.uso_local_exclusivo} onChange={handleInputChange} />
                                                <label htmlFor="uso_local" style={{ color: '#f59e0b', fontWeight: 'bold' }}>📍 Solo usar en local de origen</label>
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Máx Creds Activos</label>
                                                <input type="number" name="max_creditos_activos" value={formData.max_creditos_activos || ''} onChange={handleInputChange} placeholder="∞" />
                                            </div>
                                            <div className="form-group">
                                                <label>Cant Pedidos Máx</label>
                                                <input type="number" name="max_pedidos_generar" value={formData.max_pedidos_generar || ''} onChange={handleInputChange} placeholder="∞" />
                                            </div>
                                            <div className="form-group">
                                                <label>Tope Total $</label>
                                                <input type="number" name="max_ganancia_usuario" value={formData.max_ganancia_usuario || ''} onChange={handleInputChange} placeholder="∞" />
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>

                            <footer className="form-footer">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancelar</button>
                                <button type="submit" className="btn btn-primary large">Guardar Configuración</button>
                            </footer>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCredits;
