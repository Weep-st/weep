import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './AdminPromos.css';

const PROMO_TYPES = [
    { id: 'credito', label: 'Crédito (Cashback)', icon: '💰', color: '#e0f2fe' },
    { id: 'envio', label: 'Envío Gratis/Desc', icon: '🚚', color: '#fef3c7' },
    { id: 'fidelidad', label: 'Fidelidad (Loyalty)', icon: '💎', color: '#dcfce7' },
    { id: 'combo', label: 'COMBO WEPI', icon: '🍔', color: '#f3e8ff' },
    { id: 'cupon', label: 'Cupón Especial', icon: '🎟️', color: '#ffe4e6' },
    { id: 'diario', label: 'Oferta del Día', icon: '📅', color: '#ecfeff' },
];

const AdminPromos = () => {
    const [promos, setPromos] = useState([]);
    const [locales, setLocales] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [activeSection, setActiveSection] = useState('general');
    
    const [formData, setFormData] = useState(getInitialState());

    function getInitialState() {
        return {
            nombre: '',
            tipo: 'credito',
            activo: true,
            prioridad: 0,
            triggers: {
                min_compra: 0,
                primera_compra: false,
                metodo_pago: 'todos', // todos, efectivo, transferencia
                dias_semana: [0, 1, 2, 3, 4, 5, 6],
                local_ids: [],
                global: true,
                fecha_especifica: '',
                categorias: [],
                codigo_cupon: '',
                hora_desde: '',
                hora_hasta: ''
            },
            requisitos: {
                min_compra_uso: 0,
                metodo_pago: 'todos', // todos, efectivo, transferencia
                vencimiento_dias: 7,
                fecha_expiracion: '',
                tope_max_descuento: 0,
                max_porcentaje_uso: 50,
                uso_local_exclusivo: true
            },
            financiacion: {
                porc_wepi: 100,
                porc_local: 0
            },
            beneficios: {
                tipo_beneficio: 'porcentaje', // porcentaje, fijo, envio_gratis, producto_gratis
                valor: 10,
                tope_valor: 0,
                producto_id: '',
                categoria_id: ''
            },
            limites: {
                uso_total: null,
                uso_por_usuario: 1,
                acumulable: true
            },
            metadata: {
                terminos: ''
            }
        };
    }

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [promosData, localesData, categoriasData] = await Promise.all([
                api.adminGetPromociones(),
                api.adminGetLocales(),
                api.adminGetMenuCategorias()
            ]);
            setPromos(promosData);
            setLocales(localesData);
            setCategorias(categoriasData);
        } catch (err) {
            toast.error('Error al cargar datos');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (promo = null) => {
        if (promo) {
            setEditingPromo(promo);
            setFormData({
                ...getInitialState(),
                ...promo,
                triggers: { ...getInitialState().triggers, ...(promo.triggers || {}) },
                requisitos: { ...getInitialState().requisitos, ...(promo.requisitos || {}) },
                financiacion: { ...getInitialState().financiacion, ...(promo.financiacion || {}) },
                beneficios: { ...getInitialState().beneficios, ...(promo.beneficios || {}) },
                limites: { ...getInitialState().limites, ...(promo.limites || {}) },
                metadata: { ...getInitialState().metadata, ...(promo.metadata || {}) }
            });
        } else {
            setEditingPromo(null);
            setFormData(getInitialState());
        }
        setActiveSection('general');
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            console.log("Payload to save:", formData);
            await api.adminSavePromocion(formData);
            toast.success(editingPromo ? 'Promoción actualizada' : 'Promoción creada');
            loadData();
            setIsModalOpen(false);
        } catch (err) {
            console.error("Detailed Save Error:", err);
            toast.error('Error al guardar: ' + (err.details || err.message || 'Error desconocido'));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta promoción?')) return;
        try {
            await api.adminDeletePromocion(id);
            toast.success('Eliminado');
            loadData();
        } catch (err) {
            toast.error('Error al eliminar');
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            await api.adminTogglePromocion(id, !currentStatus);
            loadData();
        } catch (err) {
            toast.error('Error al cambiar estado');
        }
    };

    const updateNestedField = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    const renderFormSection = () => {
        switch (activeSection) {
            case 'general':
                return (
                    <div className="form-section-animate">
                        <div className="form-section-title">
                            <h4>🚀 Configuración General</h4>
                        </div>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label>Nombre de la Promoción</label>
                                <input 
                                    className="promo-input" 
                                    value={formData.nombre} 
                                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                                    placeholder="Ej: Descuento Bienvenida"
                                />
                            </div>
                            <div className="form-group full-width">
                                <label>Tipo de Promoción</label>
                                <div className="type-selector-grid">
                                    {PROMO_TYPES.map(t => (
                                        <div 
                                            key={t.id} 
                                            className={`type-option ${formData.tipo === t.id ? 'selected' : ''}`}
                                            onClick={() => setFormData({...formData, tipo: t.id})}
                                        >
                                            <span className="icon">{t.icon}</span>
                                            <label>{t.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'triggers':
                return (
                    <div className="form-section-animate">
                        <div className="form-section-title">
                            <h4>🎯 Triggers (Disparadores)</h4>
                        </div>
                        <div className="form-grid">
                            {formData.tipo === 'cupon' && (
                                <div className="form-group full-width">
                                    <label>Código del Cupón</label>
                                    <input 
                                        type="text" className="promo-input" 
                                        placeholder="Ej: WEPI50"
                                        style={{ textTransform: 'uppercase' }}
                                        value={formData.triggers.codigo_cupon || ''} 
                                        onChange={e => updateNestedField('triggers', 'codigo_cupon', e.target.value.toUpperCase())}
                                    />
                                    <small>El usuario deberá ingresar este código exacto para activar la promoción.</small>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Compra Mínima para Activar ($)</label>
                                <input 
                                    type="number" className="promo-input" 
                                    value={formData.triggers.min_compra} 
                                    onChange={e => updateNestedField('triggers', 'min_compra', Number(e.target.value))}
                                />
                            </div>
                            <div className="form-group">
                                <label>¿Solo Primera Compra?</label>
                                <div style={{marginTop: '10px'}}>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.triggers.primera_compra}
                                            onChange={e => updateNestedField('triggers', 'primera_compra', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="form-group full-width">
                                <label>Días de la Semana</label>
                                <div className="days-selector">
                                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => (
                                        <button 
                                            key={idx}
                                            type="button"
                                            className={`day-chip ${formData.triggers.dias_semana.includes(idx) ? 'selected' : ''}`}
                                            onClick={() => {
                                                const current = formData.triggers.dias_semana;
                                                const next = current.includes(idx) 
                                                    ? current.filter(d => d !== idx)
                                                    : [...current, idx];
                                                updateNestedField('triggers', 'dias_semana', next);
                                            }}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Fecha Específica (Opcional)</label>
                                <input 
                                    type="date" className="promo-input" 
                                    value={formData.triggers.fecha_especifica || ''} 
                                    onChange={e => updateNestedField('triggers', 'fecha_especifica', e.target.value)}
                                />
                                <small>Si se define, solo funcionará en esta fecha.</small>
                            </div>
                            <div className="form-group">
                                <label>Hora Desde (Opcional)</label>
                                <input 
                                    type="time" className="promo-input" 
                                    value={formData.triggers.hora_desde || ''} 
                                    onChange={e => updateNestedField('triggers', 'hora_desde', e.target.value)}
                                />
                                <small>Ej: 08:00 (Vacío para todo el día)</small>
                            </div>
                            <div className="form-group">
                                <label>Hora Hasta (Opcional)</label>
                                <input 
                                    type="time" className="promo-input" 
                                    value={formData.triggers.hora_hasta || ''} 
                                    onChange={e => updateNestedField('triggers', 'hora_hasta', e.target.value)}
                                />
                                <small>Ej: 12:00 (Vacío para todo el día)</small>
                            </div>
                            <div className="form-group">
                                <label>Método de Pago requerido (Trigger)</label>
                                <select 
                                    className="promo-input"
                                    value={formData.triggers.metodo_pago || 'todos'}
                                    onChange={e => updateNestedField('triggers', 'metodo_pago', e.target.value)}
                                >
                                    <option value="todos">Cualquier método</option>
                                    <option value="efectivo">Solo Efectivo</option>
                                    <option value="transferencia">Solo Mercado Pago</option>
                                </select>
                                <small>El usuario debe elegir este método para GANAR el beneficio.</small>
                            </div>
                            <div className="form-group full-width">
                                <label>Categorías de Menú (Opcional)</label>
                                <div className="category-chips">
                                    {categorias.map(cat => (
                                        <button 
                                            key={cat}
                                            type="button"
                                            className={`cat-chip ${formData.triggers.categorias?.includes(cat) ? 'selected' : ''}`}
                                            onClick={() => {
                                                const current = formData.triggers.categorias || [];
                                                const next = current.includes(cat)
                                                    ? current.filter(c => c !== cat)
                                                    : [...current, cat];
                                                updateNestedField('triggers', 'categorias', next);
                                            }}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                                <small>La promo solo se activará si el carrito contiene productos de estas categorías.</small>
                            </div>
                            <div className="form-group full-width">
                                <label>Aplicar en Locales:</label>
                                <select 
                                    className="promo-input"
                                    multiple
                                    value={formData.triggers.local_ids}
                                    onChange={e => {
                                        const values = Array.from(e.target.selectedOptions, option => option.value);
                                        const isGlobal = values.includes('global');
                                        setFormData(prev => ({
                                            ...prev,
                                            triggers: {
                                                ...prev.triggers,
                                                local_ids: values,
                                                global: isGlobal
                                            }
                                        }));
                                    }}
                                    style={{height: '100px'}}
                                >
                                    <option value="global">Todos los Locales (Global)</option>
                                    {locales.map(l => (
                                        <option key={l.id} value={l.id}>{l.nombre}</option>
                                    ))}
                                </select>
                                <small>Mantén Ctrl para seleccionar varios</small>
                            </div>
                        </div>
                    </div>
                );
            case 'requisitos':
                return (
                    <div className="form-section-animate">
                        <div className="form-section-title">
                            <h4>📋 Requisitos de Uso</h4>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Compra Mínima para Usar ($)</label>
                                <input 
                                    type="number" className="promo-input" 
                                    value={formData.requisitos.min_compra_uso} 
                                    onChange={e => updateNestedField('requisitos', 'min_compra_uso', Number(e.target.value))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Días de Validez (Vencimiento)</label>
                                <input 
                                    type="number" className="promo-input" 
                                    value={formData.requisitos.vencimiento_dias} 
                                    onChange={e => updateNestedField('requisitos', 'vencimiento_dias', Number(e.target.value))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Tope Máximo de Descuento ($)</label>
                                <input 
                                    type="number" className="promo-input" 
                                    value={formData.requisitos.tope_max_descuento} 
                                    onChange={e => updateNestedField('requisitos', 'tope_max_descuento', Number(e.target.value))}
                                />
                            </div>
                            <div className="form-group">
                                <label>% Máximo del Pedido a Cubrir</label>
                                <input 
                                    type="number" className="promo-input" 
                                    value={formData.requisitos.max_porcentaje_uso} 
                                    onChange={e => updateNestedField('requisitos', 'max_porcentaje_uso', Number(e.target.value))}
                                />
                            </div>
                            <div className="form-group">
                                <label>¿Uso exclusivo en local de origen?</label>
                                <div style={{marginTop: '10px'}}>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.requisitos.uso_local_exclusivo}
                                            onChange={e => updateNestedField('requisitos', 'uso_local_exclusivo', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <small>Si se activa, el beneficio solo puede usarse en el mismo local donde se generó.</small>
                            </div>
                            <div className="form-group">
                                <label>Método de Pago requerido (Uso)</label>
                                <select 
                                    className="promo-input"
                                    value={formData.requisitos.metodo_pago || 'todos'}
                                    onChange={e => updateNestedField('requisitos', 'metodo_pago', e.target.value)}
                                >
                                    <option value="todos">Cualquier método</option>
                                    <option value="efectivo">Solo Efectivo</option>
                                    <option value="transferencia">Solo Mercado Pago</option>
                                </select>
                                <small>El usuario debe elegir este método para PODER USAR el beneficio.</small>
                            </div>
                        </div>
                    </div>
                );
            case 'financiacion':
                return (
                    <div className="form-section-animate">
                        <div className="form-section-title">
                            <h4>💰 Financiación</h4>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>% Pagado por WEPI (Comisión)</label>
                                <input 
                                    type="number" className="promo-input" 
                                    value={formData.financiacion.porc_wepi} 
                                    onChange={e => updateNestedField('financiacion', 'porc_wepi', Number(e.target.value))}
                                />
                            </div>
                            <div className="form-group">
                                <label>% Pagado por el LOCAL</label>
                                <input 
                                    type="number" className="promo-input" 
                                    value={formData.financiacion.porc_local} 
                                    onChange={e => updateNestedField('financiacion', 'porc_local', Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <div style={{marginTop: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px'}}>
                            <p><strong>Resumen:</strong> El {formData.financiacion.porc_wepi}% del descuento se resta de la comisión de Wepi, y el {formData.financiacion.porc_local}% lo absorbe el comercio.</p>
                        </div>
                    </div>
                );
            case 'beneficios':
                return (
                    <div className="form-section-animate">
                        <div className="form-section-title">
                            <h4>🎁 Beneficios</h4>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Tipo de Beneficio</label>
                                <select 
                                    className="promo-input"
                                    value={formData.beneficios.tipo_beneficio}
                                    onChange={e => updateNestedField('beneficios', 'tipo_beneficio', e.target.value)}
                                >
                                    <option value="porcentaje">Porcentaje (%)</option>
                                    <option value="fijo">Monto Fijo ($)</option>
                                    <option value="envio_gratis">Envío Gratis</option>
                                    <option value="envio_fijo">Envío Valor Fijo</option>
                                    <option value="envio_descuento_fijo">Descuento Fijo en Envío ($)</option>
                                    <option value="envio_descuento_porcentaje">Descuento Porcentaje en Envío (%)</option>
                                    <option value="producto_gratis">Producto Gratis</option>
                                    <option value="regalo_wallet">Crédito de Regalo (Wallet)</option>
                                </select>
                            </div>
                            {formData.beneficios.tipo_beneficio !== 'envio_gratis' && (
                                <div className="form-group">
                                    <label>Valor del Beneficio ({['porcentaje', 'envio_descuento_porcentaje'].includes(formData.beneficios.tipo_beneficio) ? '%' : '$'})</label>
                                    <input 
                                        type="number" className="promo-input" 
                                        value={formData.beneficios.valor} 
                                        onChange={e => updateNestedField('beneficios', 'valor', Number(e.target.value))}
                                    />
                                </div>
                            )}
                            {['porcentaje', 'envio_descuento_porcentaje'].includes(formData.beneficios.tipo_beneficio) && (
                                <div className="form-group">
                                    <label>Tope de Beneficio ($)</label>
                                    <input 
                                        type="number" className="promo-input" 
                                        placeholder="Sin tope"
                                        value={formData.beneficios.tope_valor || ''} 
                                        onChange={e => updateNestedField('beneficios', 'tope_valor', Number(e.target.value))}
                                    />
                                    <small>Monto máximo a descontar por este beneficio.</small>
                                </div>
                            )}
                            {(formData.tipo === 'combo' || formData.beneficios.tipo_beneficio === 'producto_gratis') && (
                                <div className="form-group">
                                    <label>ID del Producto / Combo</label>
                                    <input 
                                        className="promo-input" 
                                        value={formData.beneficios.producto_id} 
                                        onChange={e => updateNestedField('beneficios', 'producto_id', e.target.value)}
                                        placeholder="Ej: PROD-123"
                                    />
                                </div>
                            )}
                            {formData.tipo === 'diario' && (
                                <div className="form-group">
                                    <label>Categoría Afectada (Opcional)</label>
                                    <input 
                                        className="promo-input" 
                                        value={formData.beneficios.categoria_id} 
                                        onChange={e => updateNestedField('beneficios', 'categoria_id', e.target.value)}
                                        placeholder="Ej: Pizzas"
                                    />
                                </div>
                            )}
                            {formData.tipo === 'cupon' && formData.beneficios.tipo_beneficio === 'regalo_wallet' && (
                                <div className="form-group full-width" style={{
                                    background: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    color: '#065f46',
                                    fontSize: '0.88rem',
                                    marginTop: '15px',
                                    lineHeight: '1.4'
                                }}>
                                    💡 <strong>Nota Importante:</strong> Este cupón no se aplicará como descuento en el carrito de compras del usuario. En su lugar, el usuario lo canjeará directamente ingresando el código exacto desde su Billetera (Wallet) para cargar saldo de regalo.
                                </div>
                            )}
                        </div>

                    </div>
                );
            case 'limites':
                return (
                    <div className="form-section-animate">
                        <div className="form-section-title">
                            <h4>🔒 Límites y Restricciones</h4>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Límite de Usos Totales</label>
                                <input 
                                    type="number" className="promo-input" 
                                    placeholder="∞"
                                    value={formData.limites.uso_total || ''} 
                                    onChange={e => updateNestedField('limites', 'uso_total', e.target.value === '' ? null : Number(e.target.value))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Límite por Usuario</label>
                                <input 
                                    type="number" className="promo-input" 
                                    value={formData.limites.uso_por_usuario} 
                                    onChange={e => updateNestedField('limites', 'uso_por_usuario', Number(e.target.value))}
                                />
                            </div>
                            <div className="form-group">
                                <label>¿Es acumulable con otras promos?</label>
                                <div style={{marginTop: '10px'}}>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.limites.acumulable}
                                            onChange={e => updateNestedField('limites', 'acumulable', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'legal':
                return (
                    <div className="form-section-animate">
                        <div className="form-section-title">
                            <h4>📜 Términos y Condiciones</h4>
                        </div>
                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label>Descripción Legal / Letra Chica</label>
                                <textarea 
                                    className="promo-input" 
                                    style={{height: '150px', resize: 'vertical'}}
                                    value={formData.metadata?.terminos || ''} 
                                    onChange={e => updateNestedField('metadata', 'terminos', e.target.value)}
                                    placeholder="Ej: Válido solo para compras mayores a $10.000, no incluye bebidas alcohólicas..."
                                />
                                <small>Este texto será visible para el usuario al consultar los detalles de su crédito.</small>
                            </div>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="admin-promos-container">
            <header className="panel-header">
                <div>
                    <h2>Promos y Descuentos</h2>
                    <p className="subtitle">Configura el motor de marketing de Wepi</p>
                </div>
                <button className="btn-primary large" onClick={() => handleOpenModal()}>
                    ✨ Nueva Promoción
                </button>
            </header>

            <div className="stats-summary">
                <div className="stat-card">
                    <label>Promos Activas</label>
                    <span>{promos.filter(p => p.activo).length}</span>
                </div>
                <div className="stat-card">
                    <label>Tipos Disponibles</label>
                    <span>6</span>
                </div>
                <div className="stat-card">
                    <label>Ahorro Generado (Hoy)</label>
                    <span>$0</span>
                </div>
            </div>

            {loading ? (
                <div style={{textAlign: 'center', padding: '3rem'}}>Cargando motor de promos...</div>
            ) : (
                <div className="promos-grid">
                    {promos.map(promo => (
                        <div key={promo.id} className={`promo-card ${!promo.activo ? 'inactive' : ''}`}>
                            <span className={`promo-type-badge type-${promo.tipo}`}>
                                {PROMO_TYPES.find(t => t.id === promo.tipo)?.icon} {promo.tipo}
                            </span>
                            <div className="promo-card-content">
                                <div className="promo-card-header">
                                    <h3>{promo.nombre}</h3>
                                    <p className="promo-card-desc">ID: {promo.id.substring(0, 8)}...</p>
                                </div>
                                
                                <div className="promo-main-stat">
                                    <span className="label">Beneficio</span>
                                    <span className="value">
                                        {promo.beneficios?.tipo_beneficio === 'porcentaje' ? `${promo.beneficios.valor}%` : 
                                         promo.beneficios?.tipo_beneficio === 'fijo' ? `$${promo.beneficios.valor}` : 
                                         promo.beneficios?.tipo_beneficio === 'envio_gratis' ? 'Envío Gratis' : 
                                         promo.beneficios?.tipo_beneficio === 'envio_fijo' ? `Envío a $${promo.beneficios.valor}` : 
                                         promo.beneficios?.tipo_beneficio === 'envio_descuento_fijo' ? `-$${promo.beneficios.valor} Envío` : 
                                         promo.beneficios?.tipo_beneficio === 'envio_descuento_porcentaje' ? `-${promo.beneficios.valor}% Envío` : 
                                         promo.beneficios?.tipo_beneficio === 'regalo_wallet' ? `$${promo.beneficios.valor} Wallet` : 'PROMO'}
                                    </span>
                                </div>

                                <div className="promo-details-row">
                                    <div className="detail-tag">🛒 Mín: ${promo.triggers?.min_compra || 0}</div>
                                    <div className="detail-tag">⏳ {promo.requisitos?.vencimiento_dias || 0}d</div>
                                    {promo.triggers?.primera_compra && <div className="detail-tag">🆕 1ra Compra</div>}
                                </div>

                                <div className="card-actions" style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
                                    <button className="btn btn-secondary" style={{flex: 1}} onClick={() => handleOpenModal(promo)}>Editar</button>
                                    <button className={`btn ${promo.activo ? 'btn-danger-soft' : 'btn-success-soft'}`} onClick={() => toggleStatus(promo.id, promo.activo)}>
                                        {promo.activo ? 'Pausar' : 'Activar'}
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => handleDelete(promo.id)}>🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content admin-modal promo-modal">
                        <header className="modal-header">
                            <h3>{editingPromo ? '✏️ Editar Promoción' : '✨ Nueva Promoción Unificada'}</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
                        </header>
                        
                        <form className="anatomical-form" onSubmit={handleSave}>
                            <div className="form-navigation">
                                <div className={`nav-item ${activeSection === 'general' ? 'active' : ''}`} onClick={() => setActiveSection('general')}>
                                    <span className="icon">🚀</span> General
                                </div>
                                <div className={`nav-item ${activeSection === 'triggers' ? 'active' : ''}`} onClick={() => setActiveSection('triggers')}>
                                    <span className="icon">🎯</span> Triggers
                                </div>
                                <div className={`nav-item ${activeSection === 'requisitos' ? 'active' : ''}`} onClick={() => setActiveSection('requisitos')}>
                                    <span className="icon">📋</span> Requisitos
                                </div>
                                <div className={`nav-item ${activeSection === 'financiacion' ? 'active' : ''}`} onClick={() => setActiveSection('financiacion')}>
                                    <span className="icon">💰</span> Financiación
                                </div>
                                <div className={`nav-item ${activeSection === 'beneficios' ? 'active' : ''}`} onClick={() => setActiveSection('beneficios')}>
                                    <span className="icon">🎁</span> Beneficios
                                </div>
                                <div className={`nav-item ${activeSection === 'limites' ? 'active' : ''}`} onClick={() => setActiveSection('limites')}>
                                    <span className="icon">🔒</span> Límites
                                </div>
                                <div className={`nav-item ${activeSection === 'legal' ? 'active' : ''}`} onClick={() => setActiveSection('legal')}>
                                    <span className="icon">📜</span> Legal
                                </div>
                            </div>

                            <div className="form-content-area">
                                {renderFormSection()}
                                
                                <footer className="form-footer" style={{marginTop: '2rem', display: 'flex', gap: '1rem', borderTop: '1px solid #eee', paddingTop: '1.5rem'}}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary large" style={{marginLeft: 'auto'}}>Guardar Cambios</button>
                                </footer>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPromos;
