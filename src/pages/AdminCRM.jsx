import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as api from '../services/api';
import './AdminCRM.css';

const AdminCRM = () => {
    const [usuarios, setUsuarios] = useState([]);
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [countryFilter, setCountryFilter] = useState('Todos');
    const [localFilter, setLocalFilter] = useState('Todos');
    const [inactivityDays, setInactivityDays] = useState(7); // Configurable inactivity filter
    
    // Locales list
    const [locales, setLocales] = useState([]);
    
    // Selection
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    
    // Templates
    const [templates, setTemplates] = useState([]);
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateText, setNewTemplateText] = useState('');

    useEffect(() => {
        loadData();
        loadTemplates();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, ordersData, closuresData, localesData] = await Promise.all([
                api.adminGetUsuarios(),
                api.adminGetPedidosGeneral(),
                api.getHistorialCierresLocales('Todos'),
                api.adminGetLocales()
            ]);
            
            const activeLocales = (localesData || []).filter(l => l.admin_status === 'Aceptado');
            setLocales(activeLocales);
            
            // Extract archived orders from closures
            let archivedOrders = [];
            if (closuresData) {
                closuresData.forEach(c => {
                    if (c.datos_detallados && Array.isArray(c.datos_detallados)) {
                        archivedOrders.push(...c.datos_detallados);
                    }
                });
            }

            // Merge and deduplicate
            const allOrdersMap = new Map();
            (ordersData || []).forEach(o => allOrdersMap.set(o.id, o));
            archivedOrders.forEach(o => {
                // Keep if it doesn't exist, or if we want to ensure we have it
                if (!allOrdersMap.has(o.id) && o.id) {
                    allOrdersMap.set(o.id, o);
                }
            });

            setUsuarios(usersData || []);
            setPedidos(Array.from(allOrdersMap.values()));
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar datos del CRM');
        } finally {
            setLoading(false);
        }
    };

    const loadTemplates = () => {
        const saved = localStorage.getItem('crm_templates');
        if (saved) {
            setTemplates(JSON.parse(saved));
        } else {
            // Default templates
            const defaultTemplates = [
                { id: 1, name: 'Reactivación', text: '¡Hola [Nombre]! Hace mucho no te vemos por Weep. Te dejamos un regalo especial para tu próximo pedido.' },
                { id: 2, name: 'Prospectos', text: '¡Hola [Nombre]! Vimos que te registraste pero aún no pediste. ¿Necesitas ayuda?' }
            ];
            setTemplates(defaultTemplates);
            localStorage.setItem('crm_templates', JSON.stringify(defaultTemplates));
        }
    };

    const saveTemplate = () => {
        if (!newTemplateName || !newTemplateText) {
            toast.error('Completa ambos campos');
            return;
        }
        const newTemplate = {
            id: Date.now(),
            name: newTemplateName,
            text: newTemplateText
        };
        const updated = [...templates, newTemplate];
        setTemplates(updated);
        localStorage.setItem('crm_templates', JSON.stringify(updated));
        setNewTemplateName('');
        setNewTemplateText('');
        toast.success('Plantilla guardada');
    };

    const deleteTemplate = (id) => {
        if (!window.confirm('¿Eliminar plantilla?')) return;
        const updated = templates.filter(t => t.id !== id);
        setTemplates(updated);
        localStorage.setItem('crm_templates', JSON.stringify(updated));
    };

    const enrichedUsers = useMemo(() => {
        const now = new Date();
        
        return usuarios.map(user => {
            // Find all orders for this user
            const userOrders = pedidos.filter(p => p.usuario_id === user.id || p.email_cliente === user.email);
            const deliveredOrders = userOrders.filter(p => p.estado === 'Entregado');
            
            let lastOrderDate = null;
            let daysSinceLastOrder = null;
            let estadoCRM = 'Prospecto'; // Default if 0 orders
            
            if (deliveredOrders.length > 0) {
                // Sort by date descending to get the latest
                deliveredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                lastOrderDate = new Date(deliveredOrders[0].created_at);
                
                // Calculate days diff
                const diffTime = Math.abs(now - lastOrderDate);
                daysSinceLastOrder = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (daysSinceLastOrder === 1) {
                    estadoCRM = 'Compró Ayer';
                } else if (daysSinceLastOrder > inactivityDays) {
                    estadoCRM = 'Inactivo';
                } else {
                    estadoCRM = 'Activo';
                }
            }

            // Extract unique local_ids for this user
            const localesIds = new Set();
            userOrders.forEach(p => {
                if (p.local_id) localesIds.add(p.local_id);
                if (p.locales_info && Array.isArray(p.locales_info)) {
                    p.locales_info.forEach(li => {
                        if (li.local_id) localesIds.add(li.local_id);
                    });
                }
            });

            // Clean phone number (remove spaces, dashes)
            let rawPhone = user.telefono || '';
            let cleanPhone = rawPhone.replace(/[\s-]/g, '');

            let pais = 'Desconocido';
            if (cleanPhone.startsWith('+54') || cleanPhone.startsWith('54') || (cleanPhone.length >= 10 && !cleanPhone.startsWith('+') && !cleanPhone.startsWith('5'))) {
                pais = 'Argentina';
            } else if (cleanPhone.startsWith('+55') || cleanPhone.startsWith('55')) {
                pais = 'Brasil';
            }

            return {
                ...user,
                total_pedidos: deliveredOrders.length,
                ultimo_pedido_fecha: lastOrderDate,
                dias_inactivo: daysSinceLastOrder,
                estado_crm: estadoCRM,
                clean_phone: cleanPhone,
                pais,
                locales_ids: Array.from(localesIds)
            };
        });
    }, [usuarios, pedidos, inactivityDays]);

    const filteredUsers = useMemo(() => {
        return enrichedUsers.filter(user => {
            const matchesSearch = 
                user.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.telefono?.includes(searchTerm);
            
            const matchesStatus = statusFilter === 'Todos' || user.estado_crm === statusFilter;
            const matchesCountry = countryFilter === 'Todos' || user.pais === countryFilter;
            const matchesLocal = localFilter === 'Todos' || user.locales_ids.includes(localFilter);
            
            return matchesSearch && matchesStatus && matchesCountry && matchesLocal;
        }).sort((a, b) => (b.total_pedidos || 0) - (a.total_pedidos || 0));
    }, [enrichedUsers, searchTerm, statusFilter, countryFilter, localFilter]);

    // Statistics
    const stats = useMemo(() => {
        return {
            total: enrichedUsers.length,
            activos: enrichedUsers.filter(u => u.estado_crm === 'Activo').length,
            inactivos: enrichedUsers.filter(u => u.estado_crm === 'Inactivo').length,
            prospectos: enrichedUsers.filter(u => u.estado_crm === 'Prospecto').length
        };
    }, [enrichedUsers]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
        } else {
            setSelectedUsers(new Set());
        }
    };

    const handleSelectUser = (id) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedUsers(newSet);
    };

    const copySelectedPhones = () => {
        let usersToCopy = filteredUsers.filter(u => selectedUsers.has(u.id));
        if (usersToCopy.length === 0) {
            // Si no hay seleccionados, copia todos los filtrados
            usersToCopy = filteredUsers;
        }

        const validPhones = usersToCopy
            .map(u => u.clean_phone)
            .filter(phone => phone && phone.length > 5);

        if (validPhones.length === 0) {
            toast.error('No hay números válidos para copiar');
            return;
        }

        const stringList = validPhones.join(',');
        navigator.clipboard.writeText(stringList).then(() => {
            toast.success(`Se copiaron ${validPhones.length} números`);
        }).catch(err => {
            toast.error('Error al copiar');
            console.error(err);
        });
    };

    const getWhatsAppLink = (phone, name, templateText = '') => {
        if (!phone) return '#';
        let text = templateText;
        if (text) {
            text = text.replace(/\[Nombre\]/gi, name || '');
            text = encodeURIComponent(text);
        }
        return `https://wa.me/${phone}?text=${text}`;
    };

    const formatDate = (date) => {
        if (!date) return 'Nunca';
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const renderBadgeClass = (estado) => {
        switch (estado) {
            case 'Prospecto': return 'badge-crm badge-prospecto';
            case 'Activo': return 'badge-crm badge-activo';
            case 'Inactivo': return 'badge-crm badge-inactivo';
            case 'Compró Ayer': return 'badge-crm badge-compro-ayer';
            default: return 'badge-crm';
        }
    };

    if (loading) return <div className="loading-state">Cargando datos del CRM...</div>;

    return (
        <div className="admin-crm-container animate-fade-in">
            <div className="header-info" style={{ marginBottom: '10px' }}>
                <h2>CRM & Gestión de Clientes</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Analiza y contacta a tu base de usuarios</p>
            </div>

            <div className="crm-kpi-grid">
                <div className="crm-kpi-card">
                    <h3>{stats.total}</h3>
                    <p>Total Contactos</p>
                </div>
                <div className="crm-kpi-card" style={{ borderColor: '#dcfce7', background: '#f0fdf4' }}>
                    <h3 style={{ color: '#166534' }}>{stats.activos}</h3>
                    <p style={{ color: '#166534' }}>Activos</p>
                </div>
                <div className="crm-kpi-card" style={{ borderColor: '#fee2e2', background: '#fef2f2' }}>
                    <h3 style={{ color: '#b91c1c' }}>{stats.inactivos}</h3>
                    <p style={{ color: '#b91c1c' }}>Inactivos (&gt; {inactivityDays} días)</p>
                </div>
                <div className="crm-kpi-card" style={{ borderColor: '#e0e7ff', background: '#eef2ff' }}>
                    <h3 style={{ color: '#4338ca' }}>{stats.prospectos}</h3>
                    <p style={{ color: '#4338ca' }}>Prospectos</p>
                </div>
                <div className="crm-kpi-card" style={{ borderColor: '#fef08a', background: '#fefce8' }}>
                    <h3 style={{ color: '#a16207' }}>{pedidos.length}</h3>
                    <p style={{ color: '#a16207' }}>Total Pedidos Globales</p>
                </div>
            </div>

            <div className="crm-filters">
                <div className="crm-filter-group">
                    <label>Buscar</label>
                    <input 
                        type="text" 
                        placeholder="Nombre, email, teléfono..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="crm-filter-group">
                    <label>Estado CRM</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="Todos">Todos</option>
                        <option value="Activo">Activos</option>
                        <option value="Inactivo">Inactivos</option>
                        <option value="Prospecto">Prospectos</option>
                        <option value="Compró Ayer">Compraron Ayer</option>
                    </select>
                </div>

                <div className="crm-filter-group">
                    <label>País</label>
                    <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                        <option value="Todos">Todos</option>
                        <option value="Argentina">Argentina (+549)</option>
                        <option value="Brasil">Brasil (+55)</option>
                        <option value="Desconocido">Otro / Desconocido</option>
                    </select>
                </div>

                <div className="crm-filter-group">
                    <label>Local de Compra</label>
                    <select value={localFilter} onChange={(e) => setLocalFilter(e.target.value)}>
                        <option value="Todos">Cualquier Local</option>
                        {locales.map(l => (
                            <option key={l.id} value={l.id}>{l.nombre}</option>
                        ))}
                    </select>
                </div>

                <div className="crm-filter-group" style={{ maxWidth: '120px' }}>
                    <label>Días Inactividad</label>
                    <input 
                        type="number" 
                        min="1" 
                        value={inactivityDays}
                        onChange={(e) => setInactivityDays(parseInt(e.target.value) || 7)}
                    />
                </div>

                <div className="crm-actions">
                    <button className="btn-crm-action btn-crm-secondary" onClick={() => setShowTemplatesModal(true)}>
                        📝 Plantillas
                    </button>
                    <button className="btn-crm-action" onClick={copySelectedPhones}>
                        📋 Copiar Números
                    </button>
                </div>
            </div>

            <div className="crm-table-container">
                <table className="crm-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}>
                                <input 
                                    type="checkbox" 
                                    onChange={handleSelectAll}
                                    checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                                />
                            </th>
                            <th>Cliente</th>
                            <th>Teléfono</th>
                            <th>País</th>
                            <th>Pedidos</th>
                            <th>Última Compra</th>
                            <th>Estado</th>
                            <th>Contacto Rápido (WA)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>No se encontraron clientes</td></tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id}>
                                    <td>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedUsers.has(user.id)}
                                            onChange={() => handleSelectUser(user.id)}
                                        />
                                    </td>
                                    <td>
                                        <div className="user-info">
                                            <span className="user-name">{user.nombre || 'Sin nombre'}</span>
                                            <span className="user-email">{user.email}</span>
                                        </div>
                                    </td>
                                    <td>{user.telefono || '-'}</td>
                                    <td>
                                        {user.pais === 'Argentina' && '🇦🇷 '}
                                        {user.pais === 'Brasil' && '🇧🇷 '}
                                        {user.pais === 'Desconocido' && '❓ '}
                                        {user.pais}
                                    </td>
                                    <td>
                                        <strong>{user.total_pedidos}</strong>
                                    </td>
                                    <td>
                                        {formatDate(user.ultimo_pedido_fecha)}
                                        {user.dias_inactivo !== null && (
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Hace {user.dias_inactivo} días</div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={renderBadgeClass(user.estado_crm)}>{user.estado_crm}</span>
                                    </td>
                                    <td>
                                        <div className="crm-row-actions">
                                            {templates.length > 0 ? (
                                                <select 
                                                    className="template-select" 
                                                    style={{ padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', maxWidth: '120px', fontSize: '0.8rem' }}
                                                    onChange={(e) => {
                                                        if (!e.target.value) return;
                                                        const tmpl = templates.find(t => t.id.toString() === e.target.value);
                                                        if (tmpl && user.clean_phone) {
                                                            window.open(getWhatsAppLink(user.clean_phone, user.nombre, tmpl.text), '_blank');
                                                        }
                                                        e.target.value = ""; // reset
                                                    }}
                                                >
                                                    <option value="">Enviar...</option>
                                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            ) : (
                                                <a 
                                                    href={getWhatsAppLink(user.clean_phone, user.nombre, '')} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="btn-wa"
                                                >
                                                    WA
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Plantillas */}
            {showTemplatesModal && (
                <div className="crm-templates-modal" onClick={() => setShowTemplatesModal(false)}>
                    <div className="crm-templates-content" onClick={e => e.stopPropagation()}>
                        <div className="crm-templates-header">
                            <h3>Plantillas de Mensajes</h3>
                            <button className="close-modal-btn" onClick={() => setShowTemplatesModal(false)}>&times;</button>
                        </div>
                        
                        <div className="template-list">
                            {templates.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No hay plantillas guardadas.</p>
                            ) : (
                                templates.map(t => (
                                    <div key={t.id} className="template-item">
                                        <h4>{t.name}</h4>
                                        <p>{t.text}</p>
                                        <div className="template-actions">
                                            <button className="btn-small btn-delete" onClick={() => deleteTemplate(t.id)}>Eliminar</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="add-template-form">
                            <h4 style={{ margin: '0 0 5px 0', fontSize: '0.95rem' }}>Nueva Plantilla</h4>
                            <input 
                                type="text" 
                                placeholder="Nombre (ej: Promo Inactivos)" 
                                value={newTemplateName}
                                onChange={e => setNewTemplateName(e.target.value)}
                            />
                            <textarea 
                                placeholder="Texto del mensaje. Usa [Nombre] para que se reemplace por el nombre del cliente."
                                value={newTemplateText}
                                onChange={e => setNewTemplateText(e.target.value)}
                            />
                            <button className="btn-save" onClick={saveTemplate}>Guardar Plantilla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCRM;
