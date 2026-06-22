import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import * as api from '../services/api';
import './AdminCRM.css';

const AdminCRM = () => {
    // Sub-navigation tabs
    const [activeTab, setActiveTab] = useState('dashboard');
    
    // Core data states
    const [usuarios, setUsuarios] = useState([]);
    const [tags, setTags] = useState([]);
    const [automations, setAutomations] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [scoreConfig, setScoreConfig] = useState([]);
    const [eventsLog, setEventsLog] = useState([]);
    const [historyLog, setHistoryLog] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter states for Clientes tab
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [cityFilter, setCityFilter] = useState('Todos');
    const [tagFilter, setTagFilter] = useState('Todos');
    const [scoreMinFilter, setScoreMinFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Todos');
    const [inactivityDaysFilter, setInactivityDaysFilter] = useState('Todos');
    const [selectedUsers, setSelectedUsers] = useState(new Set());

    // Modals and Active Edit objects
    const [selectedUserDetail, setSelectedUserDetail] = useState(null);
    const [userDetailHistory, setUserDetailHistory] = useState([]);
    const [userDetailEvents, setUserDetailEvents] = useState([]);
    const [newTagInput, setNewTagInput] = useState('');
    const [newTagIdInput, setNewTagIdInput] = useState('');
    
    // Automation Form State
    const [showAutomationModal, setShowAutomationModal] = useState(false);
    const [activeAutomation, setActiveAutomation] = useState(null);
    const [automationForm, setAutomationForm] = useState({
        nombre: '',
        evento_disparador: 'USER_REGISTERED',
        condiciones: { ciudad: 'Todos', categoria_favorita: 'Todos' },
        canal: 'push',
        mensaje: '',
        tiempo_espera: 0,
        prioridad: 0,
        estado: true
    });

    // Campaign Form State
    const [campaignForm, setCampaignForm] = useState({
        nombre: '',
        filtros: {
            ciudad: 'Todos',
            estado_crm: 'Todos',
            tag: 'Todos',
            pedidos_min: 0,
            dias_inactivo_min: 0,
            categoria_favorita: 'Todos',
            score_min: 0
        },
        canal: 'push',
        mensaje: '',
        estado: 'Borrador',
        fecha_programada: ''
    });

    // Quick template message sender in User Ficha
    const [selectedUserTemplateText, setSelectedUserTemplateText] = useState('');
    const [selectedUserTemplateChannel, setSelectedUserTemplateChannel] = useState('push');

    useEffect(() => {
        loadAllCRMData();
    }, []);

    const loadAllCRMData = async () => {
        setLoading(true);
        try {
            const [usersRes, tagsRes, autoRes, campRes, scoreRes, eventsRes, historyRes] = await Promise.all([
                api.adminGetCRMUsers(),
                api.adminGetCRMTags(),
                api.adminGetCRMAutomations(),
                api.adminGetCRMCampaigns(),
                api.adminGetCRMScoreConfig(),
                api.adminGetCRMEvents(),
                api.adminGetCRMHistory()
            ]);

            setUsuarios(usersRes || []);
            setTags(tagsRes || []);
            setAutomations(autoRes || []);
            setCampaigns(campRes || []);
            setScoreConfig(scoreRes || []);
            setEventsLog(eventsRes || []);
            setHistoryLog(historyRes || []);
        } catch (err) {
            console.error("Error loading CRM datasets:", err);
            toast.error("Error al cargar datos del CRM. Revisa la base de datos.");
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // INACTIVITY ACTION
    // ─────────────────────────────────────────────────────────────
    const handleRunInactivityScan = async () => {
        const loadToast = toast.loading("Escaneando inactividad de usuarios...");
        try {
            const result = await api.adminRunCRMInactivityCheck();
            toast.dismiss(loadToast);
            if (result && result.success) {
                toast.success(`Escaneo completado. Clientes pasados a DORMIDO: ${result.updated_count}`);
                loadAllCRMData();
            } else {
                toast.error("Error en el escaneo de inactividad");
            }
        } catch (err) {
            toast.dismiss(loadToast);
            toast.error("Error al ejecutar scan: " + err.message);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // CLASIFICACION & KPIs
    // ─────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = usuarios.length;
        const porEstado = {
            VISITANTE: 0,
            REGISTRADO: 0,
            PRIMER_PEDIDO: 0,
            CLIENTE_ACTIVO: 0,
            CLIENTE_FRECUENTE: 0,
            VIP: 0,
            DORMIDO: 0,
            RECUPERADO: 0
        };

        let totalSpent = 0;
        let totalOrders = 0;
        let usersWithOrders = 0;

        usuarios.forEach(u => {
            const st = u.estado_crm || 'REGISTRADO';
            if (porEstado[st] !== undefined) porEstado[st]++;
            
            const orders = Number(u.cantidad_pedidos) || 0;
            const spent = Number(u.total_gastado) || 0;
            
            totalOrders += orders;
            totalSpent += spent;
            if (orders > 0) usersWithOrders++;
        });

        const recoveredCount = porEstado.RECUPERADO || 0;
        const dormantCount = porEstado.DORMIDO || 0;
        const totalTargetedForRecovery = dormantCount + recoveredCount;
        const recoveryRate = totalTargetedForRecovery > 0 ? ((recoveredCount / totalTargetedForRecovery) * 100).toFixed(1) : 0;
        
        return {
            total,
            porEstado,
            avgOrders: total > 0 ? (totalOrders / total).toFixed(1) : 0,
            avgTicket: usersWithOrders > 0 ? (totalSpent / totalOrders).toFixed(0) : 0,
            totalSpent,
            recoveryRate
        };
    }, [usuarios]);

    // ─────────────────────────────────────────────────────────────
    // CLIENTES: FILTRADO Y BUSQUEDA
    // ─────────────────────────────────────────────────────────────
    const filteredUsers = useMemo(() => {
        return usuarios.filter(user => {
            // Search
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                !searchTerm ||
                (user.nombre && user.nombre.toLowerCase().includes(searchLower)) ||
                (user.email && user.email.toLowerCase().includes(searchLower)) ||
                (user.telefono && user.telefono.includes(searchTerm));

            // State
            const matchesStatus = statusFilter === 'Todos' || user.estado_crm === statusFilter;

            // City
            const matchesCity = cityFilter === 'Todos' || user.ciudad === cityFilter;

            // Dynamic Tag
            const matchesTag = tagFilter === 'Todos' || (user.crm_usuario_tags && user.crm_usuario_tags.some(t => t.tag_id === tagFilter));

            // Category
            const matchesCategory = categoryFilter === 'Todos' || user.categoria_favorita === categoryFilter;

            // Score
            const scoreVal = Number(user.wepi_score) || 0;
            const matchesScore = !scoreMinFilter || scoreVal >= Number(scoreMinFilter);

            // Inactivity days
            let matchesInactivity = true;
            if (inactivityDaysFilter !== 'Todos') {
                const daysVal = user.fecha_ultimo_pedido ? Math.floor((new Date() - new Date(user.fecha_ultimo_pedido)) / (1000 * 60 * 60 * 24)) : 999;
                if (inactivityDaysFilter === '7') matchesInactivity = daysVal >= 7 && daysVal < 15;
                else if (inactivityDaysFilter === '15') matchesInactivity = daysVal >= 15 && daysVal < 30;
                else if (inactivityDaysFilter === '30') matchesInactivity = daysVal >= 30 && daysVal < 60;
                else if (inactivityDaysFilter === '60') matchesInactivity = daysVal >= 60 && daysVal < 90;
                else if (inactivityDaysFilter === '90') matchesInactivity = daysVal >= 90;
            }

            return matchesSearch && matchesStatus && matchesCity && matchesTag && matchesCategory && matchesScore && matchesInactivity;
        });
    }, [usuarios, searchTerm, statusFilter, cityFilter, tagFilter, categoryFilter, scoreMinFilter, inactivityDaysFilter]);

    // Dynamic Lists (Quick Access Lists)
    const handleQuickAccessList = (listType) => {
        setSearchTerm('');
        setCityFilter('Todos');
        setTagFilter('Todos');
        setCategoryFilter('Todos');
        setScoreMinFilter('');
        setInactivityDaysFilter('Todos');
        
        if (listType === 'prospectos') {
            setStatusFilter('Todos');
            setInactivityDaysFilter('Todos');
            // Prospects are registered but have 0 orders
            setSearchTerm('');
            // Filter below manually
            setUsuarios(prev => prev.map(u => u)); // trigger recalculate
            setStatusFilter('REGISTRADO');
        } else {
            setStatusFilter(listType.toUpperCase());
        }
    };

    // User Selection Handlers
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
        } else {
            setSelectedUsers(new Set());
        }
    };

    const handleSelectUser = (id) => {
        const next = new Set(selectedUsers);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedUsers(next);
    };

    // Bulk action tags
    const handleBulkTagAdd = async (tagId) => {
        if (!tagId || selectedUsers.size === 0) return;
        const load = toast.loading(`Añadiendo etiqueta ${tagId} a ${selectedUsers.size} usuarios...`);
        try {
            await Promise.all(
                Array.from(selectedUsers).map(uid => api.adminAddTagToUser(uid, tagId).catch(() => null))
            );
            toast.dismiss(load);
            toast.success("Etiquetas aplicadas con éxito");
            loadAllCRMData();
        } catch (err) {
            toast.dismiss(load);
            toast.error("Error al aplicar etiquetas masivas");
        }
    };

    // Copiar teléfonos en formato internacional separados por coma
    const copySelectedPhones = () => {
        if (selectedUsers.size === 0) return;
        
        const selectedList = usuarios.filter(u => selectedUsers.has(u.id));
        const formattedPhones = selectedList
            .map(u => {
                const rawPhone = u.telefono || '';
                // Limpiar espacios, guiones, paréntesis y símbolos de suma sobrantes
                let clean = rawPhone.replace(/[\s\-\(\)\+]/g, '');
                if (!clean) return null;
                
                // Brasil (código de país 55)
                if (clean.startsWith('55')) {
                    return '+' + clean;
                }
                
                // Argentina (código de país 54)
                if (clean.startsWith('54')) {
                    if (clean.startsWith('549')) {
                        return '+' + clean;
                    } else {
                        // Insertar el prefijo móvil internacional '9'
                        return '+549' + clean.substring(2);
                    }
                }
                
                // Formatos locales argentinos
                if (clean.length === 10) {
                    return '+549' + clean;
                }
                
                if (clean.length === 11 && clean.startsWith('9')) {
                    return '+549' + clean.substring(1);
                }
                
                if (clean.startsWith('0') && clean.length === 11) {
                    return '+549' + clean.substring(1);
                }
                
                if (clean.startsWith('15') && clean.length === 8) {
                    const areaCode = u.ciudad === 'Oberá' ? '3755' : '3756';
                    return '+549' + areaCode + clean.substring(2);
                }
                
                if (clean.length === 8) {
                    const areaCode = u.ciudad === 'Oberá' ? '3755' : '3756';
                    return '+549' + areaCode + clean;
                }

                if (clean.length >= 10) {
                    if (clean.startsWith('9')) {
                        return '+549' + clean.substring(1);
                    }
                    return '+549' + clean;
                }

                return '+549' + clean; // fallback general para Argentina
            })
            .filter(Boolean);

        if (formattedPhones.length === 0) {
            toast.error("No hay números de teléfono válidos para copiar");
            return;
        }

        const textToCopy = formattedPhones.join(',');
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast.success(`Se copiaron ${formattedPhones.length} teléfonos en formato internacional`);
        }).catch(err => {
            toast.error("Error al copiar al portapapeles");
            console.error(err);
        });
    };

    // Ficha de Usuario (Modal)
    const handleOpenUserDetail = async (user) => {
        setSelectedUserDetail(user);
        setSelectedUserTemplateText('');
        try {
            const [history, events] = await Promise.all([
                api.adminGetCRMHistory(user.id),
                api.adminGetCRMEvents(user.id)
            ]);
            setUserDetailHistory(history || []);
            setUserDetailEvents(events || []);
        } catch (err) {
            toast.error("Error al cargar historial del usuario");
        }
    };

    const handleAddUserTag = async (userId, tagId) => {
        if (!tagId) return;
        try {
            await api.adminAddTagToUser(userId, tagId);
            toast.success("Etiqueta añadida");
            // Refresh detail mapping
            setUsuarios(prev => prev.map(u => {
                if (u.id === userId) {
                    const activeTags = u.crm_usuario_tags || [];
                    if (!activeTags.some(t => t.tag_id === tagId)) {
                        return { ...u, crm_usuario_tags: [...activeTags, { tag_id: tagId }] };
                    }
                }
                return u;
            }));
        } catch (err) {
            toast.error("Error al añadir etiqueta");
        }
    };

    const handleRemoveUserTag = async (userId, tagId) => {
        try {
            await api.adminRemoveTagFromUser(userId, tagId);
            toast.success("Etiqueta eliminada");
            setUsuarios(prev => prev.map(u => {
                if (u.id === userId) {
                    return { ...u, crm_usuario_tags: (u.crm_usuario_tags || []).filter(t => t.tag_id !== tagId) };
                }
                return u;
            }));
        } catch (err) {
            toast.error("Error al eliminar etiqueta");
        }
    };

    const handleSendDirectMessage = async () => {
        if (!selectedUserDetail) return;
        if (!selectedUserTemplateText) {
            toast.error("Por favor, escribe un mensaje");
            return;
        }

        const loader = toast.loading("Enviando mensaje...");
        try {
            const result = await api.adminSendCRMMessage(
                selectedUserDetail.id,
                selectedUserTemplateChannel,
                selectedUserTemplateText
            );
            toast.dismiss(loader);
            if (result.success) {
                toast.success(`Mensaje procesado: ${result.logDetail}`);
                // Refresh log
                const history = await api.adminGetCRMHistory(selectedUserDetail.id);
                setUserDetailHistory(history);
            }
        } catch (err) {
            toast.dismiss(loader);
            toast.error("Error al enviar mensaje: " + err.message);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // AUTOMATIZACIONES
    // ─────────────────────────────────────────────────────────────
    const handleOpenNewAutomation = () => {
        setActiveAutomation(null);
        setAutomationForm({
            nombre: '',
            evento_disparador: 'USER_REGISTERED',
            condiciones: { ciudad: 'Todos', categoria_favorita: 'Todos' },
            canal: 'push',
            mensaje: '',
            tiempo_espera: 0,
            prioridad: 0,
            estado: true
        });
        setShowAutomationModal(true);
    };

    const handleOpenEditAutomation = (aut) => {
        setActiveAutomation(aut);
        setAutomationForm({
            ...aut,
            condiciones: aut.condiciones || { ciudad: 'Todos', categoria_favorita: 'Todos' }
        });
        setShowAutomationModal(true);
    };

    const handleSaveAutomation = async () => {
        if (!automationForm.nombre || !automationForm.mensaje) {
            toast.error("Completa el nombre y mensaje");
            return;
        }

        try {
            const data = {
                ...automationForm,
                id: activeAutomation ? activeAutomation.id : undefined
            };
            await api.adminSaveCRMAutomation(data);
            toast.success("Automatización guardada");
            setShowAutomationModal(false);
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al guardar automatización: " + err.message);
        }
    };

    const handleDeleteAutomation = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta automatización?")) return;
        try {
            await api.adminDeleteCRMAutomation(id);
            toast.success("Automatización eliminada");
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al eliminar");
        }
    };

    const handleToggleAutomationStatus = async (aut) => {
        try {
            const updated = { ...aut, estado: !aut.estado };
            await api.adminSaveCRMAutomation(updated);
            toast.success(updated.estado ? "Automatización activada" : "Automatización desactivada");
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al cambiar estado");
        }
    };

    // ─────────────────────────────────────────────────────────────
    // CAMPAÑAS
    // ─────────────────────────────────────────────────────────────
    const targetedCampaignUsersCount = useMemo(() => {
        const f = campaignForm.filtros;
        return usuarios.filter(user => {
            const matchesCity = f.ciudad === 'Todos' || user.ciudad === f.ciudad;
            const matchesState = f.estado_crm === 'Todos' || user.estado_crm === f.estado_crm;
            const matchesTag = f.tag === 'Todos' || (user.crm_usuario_tags && user.crm_usuario_tags.some(t => t.tag_id === f.tag));
            const matchesOrders = (Number(user.cantidad_pedidos) || 0) >= (Number(f.pedidos_min) || 0);
            
            const daysVal = user.fecha_ultimo_pedido ? Math.floor((new Date() - new Date(user.fecha_ultimo_pedido)) / (1000 * 60 * 60 * 24)) : 999;
            const matchesInact = daysVal >= (Number(f.dias_inactivo_min) || 0);
            
            const matchesCat = f.categoria_favorita === 'Todos' || user.categoria_favorita === f.categoria_favorita;
            const matchesScore = (Number(user.wepi_score) || 0) >= (Number(f.score_min) || 0);

            return matchesCity && matchesState && matchesTag && matchesOrders && matchesInact && matchesCat && matchesScore;
        }).length;
    }, [usuarios, campaignForm.filtros]);

    const handleLaunchCampaign = async () => {
        if (!campaignForm.nombre || !campaignForm.mensaje) {
            toast.error("Completa el nombre y el mensaje de la campaña");
            return;
        }

        const isScheduled = !!campaignForm.fecha_programada;
        const msgType = isScheduled ? "programar" : "lanzar";
        
        if (!window.confirm(`¿Seguro que deseas ${msgType} esta campaña para ${targetedCampaignUsersCount} usuarios?`)) {
            return;
        }

        const loader = toast.loading(`${isScheduled ? 'Programando' : 'Ejecutando'} campaña...`);
        try {
            // Save Campaign
            const data = {
                ...campaignForm,
                estado: isScheduled ? 'Programada' : 'Enviada',
                fecha_programada: isScheduled ? new Date(campaignForm.fecha_programada).toISOString() : null
            };
            
            const saved = await api.adminSaveCRMCampaign(data);

            if (!isScheduled) {
                // Execute immediately for matched users
                const f = campaignForm.filtros;
                const targets = usuarios.filter(user => {
                    const matchesCity = f.ciudad === 'Todos' || user.ciudad === f.ciudad;
                    const matchesState = f.estado_crm === 'Todos' || user.estado_crm === f.estado_crm;
                    const matchesTag = f.tag === 'Todos' || (user.crm_usuario_tags && user.crm_usuario_tags.some(t => t.tag_id === f.tag));
                    const matchesOrders = (Number(user.cantidad_pedidos) || 0) >= (Number(f.pedidos_min) || 0);
                    
                    const daysVal = user.fecha_ultimo_pedido ? Math.floor((new Date() - new Date(user.fecha_ultimo_pedido)) / (1000 * 60 * 60 * 24)) : 999;
                    const matchesInact = daysVal >= (Number(f.dias_inactivo_min) || 0);
                    
                    const matchesCat = f.categoria_favorita === 'Todos' || user.categoria_favorita === f.categoria_favorita;
                    const matchesScore = (Number(user.wepi_score) || 0) >= (Number(f.score_min) || 0);

                    return matchesCity && matchesState && matchesTag && matchesOrders && matchesInact && matchesCat && matchesScore;
                });

                // Send messages
                let successCount = 0;
                for (const u of targets) {
                    try {
                        const result = await api.adminSendCRMMessage(u.id, campaignForm.canal, campaignForm.mensaje, campaignForm.nombre);
                        if (result.success) successCount++;
                    } catch (e) {
                        console.error("Failed sending message to user during campaign:", u.id, e);
                    }
                }
                toast.dismiss(loader);
                toast.success(`Campaña enviada con éxito. Mensajes entregados: ${successCount} de ${targets.length}`);
            } else {
                toast.dismiss(loader);
                toast.success("Campaña programada exitosamente");
            }
            
            // Reset Campaign Form
            setCampaignForm({
                nombre: '',
                filtros: {
                    ciudad: 'Todos',
                    estado_crm: 'Todos',
                    tag: 'Todos',
                    pedidos_min: 0,
                    dias_inactivo_min: 0,
                    categoria_favorita: 'Todos',
                    score_min: 0
                },
                canal: 'push',
                mensaje: '',
                estado: 'Borrador',
                fecha_programada: ''
            });

            loadAllCRMData();
        } catch (err) {
            toast.dismiss(loader);
            toast.error("Error al procesar la campaña: " + err.message);
        }
    };

    const handleDeleteCampaign = async (id) => {
        if (!window.confirm("¿Eliminar esta campaña del historial?")) return;
        try {
            await api.adminDeleteCRMCampaign(id);
            toast.success("Campaña eliminada");
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al eliminar campaña");
        }
    };

    // ─────────────────────────────────────────────────────────────
    // RETENCION COHORT STATISTICS
    // ─────────────────────────────────────────────────────────────
    const retentionCohorts = useMemo(() => {
        const now = new Date();
        const ranges = [
            { id: '7', label: '7 a 14 días sin comprar', min: 7, max: 14 },
            { id: '15', label: '15 a 29 días sin comprar', min: 15, max: 29 },
            { id: '30', label: '30 a 59 días sin comprar (Alerta Inactivos)', min: 30, max: 59 },
            { id: '60', label: '60 a 89 días sin comprar', min: 60, max: 89 },
            { id: '90', label: 'Más de 90 días sin comprar (Dormidos críticos)', min: 90, max: 9999 }
        ];

        return ranges.map(rng => {
            const segmentUsers = usuarios.filter(u => {
                if (!u.fecha_ultimo_pedido) return false;
                const days = Math.floor((now - new Date(u.fecha_ultimo_pedido)) / (1000 * 60 * 60 * 24));
                return days >= rng.min && days <= rng.max;
            });

            // Conversion (Users in segment who made orders later? Let's check history or look at recoveries)
            const recoveredInSegment = segmentUsers.filter(u => u.estado_crm === 'RECUPERADO').length;
            const rate = segmentUsers.length > 0 ? ((recoveredInSegment / segmentUsers.length) * 100).toFixed(1) : '0';

            // Messages count: count messages logged in history log linked to these users
            const uids = new Set(segmentUsers.map(u => u.id));
            const msgCount = historyLog.filter(h => h.tipo === 'mensaje_enviado' && uids.has(h.usuario_id)).length;

            return {
                ...rng,
                count: segmentUsers.length,
                rate,
                messagesSent: msgCount
            };
        });
    }, [usuarios, historyLog]);

    const handleFilterCohort = (cohortId) => {
        setInactivityDaysFilter(cohortId);
        setStatusFilter('Todos');
        setActiveTab('clientes');
    };

    const handlePrepopulateCohortCampaign = (cohortId) => {
        const rng = retentionCohorts.find(r => r.id === cohortId);
        setCampaignForm(prev => ({
            ...prev,
            nombre: `Campaña de Retención - ${rng.label}`,
            filtros: {
                ...prev.filtros,
                dias_inactivo_min: rng.min,
                estado_crm: cohortId >= 30 ? 'DORMIDO' : 'Todos'
            }
        }));
        setActiveTab('campanas');
    };

    // ─────────────────────────────────────────────────────────────
    // CONFIGURACION: TAGS DYNAMIC
    // ─────────────────────────────────────────────────────────────
    const handleCreateTag = async () => {
        if (!newTagIdInput || !newTagInput) {
            toast.error("Completa la ID y el Nombre de la etiqueta");
            return;
        }
        const cleanedId = newTagIdInput.toUpperCase().replace(/[\s-]/g, '_');
        try {
            await api.adminCreateCRMTag(cleanedId, newTagInput);
            toast.success("Etiqueta registrada");
            setNewTagIdInput('');
            setNewTagInput('');
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al registrar etiqueta (posible ID duplicada)");
        }
    };

    const handleDeleteTag = async (tagId) => {
        if (!window.confirm(`¿Seguro que deseas eliminar la etiqueta ${tagId}? Se desvinculará de todos los usuarios.`)) return;
        try {
            await api.adminDeleteCRMTag(tagId);
            toast.success("Etiqueta eliminada");
            loadAllCRMData();
        } catch (err) {
            toast.error("Error al eliminar etiqueta");
        }
    };

    // CONFIGURACION: WEPI SCORE WEIGHTS
    const handleUpdateScoreWeight = (configId, val) => {
        setScoreConfig(prev => prev.map(c => c.id === configId ? { ...c, puntos: parseInt(val) || 0 } : c));
    };

    const handleSaveScoreWeights = async () => {
        const loader = toast.loading("Guardando pesos del Score...");
        try {
            await api.adminSaveCRMScoreConfig(scoreConfig);
            toast.dismiss(loader);
            toast.success("Puntajes de Score actualizados. Los scores se recalcularán automáticamente con futuros pedidos.");
            loadAllCRMData();
        } catch (err) {
            toast.dismiss(loader);
            toast.error("Error al guardar configuraciones de score: " + err.message);
        }
    };

    // Format utility
    const formatCurrency = (val) => {
        return `$${(Number(val) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
    };

    const formatDateStr = (date) => {
        if (!date) return 'Nunca';
        return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Loading State
    if (loading) {
        return (
            <div className="crm-loading-wrapper">
                <div className="spinner"></div>
                <p>Cargando panel CRM y automatizaciones de Wepi...</p>
            </div>
        );
    }

    return (
        <div className="wepi-crm-container animate-fade-in">
            {/* Header section */}
            <div className="wepi-crm-header">
                <div className="header-titles">
                    <h1>Growth & Retention CRM</h1>
                    <p>Gestión y automatización de clientes basado en eventos y comportamiento</p>
                </div>
                <div className="header-actions">
                    <button className="btn-scan" onClick={handleRunInactivityScan}>
                        🔄 Escanear Inactividad
                    </button>
                </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="wepi-crm-tabs">
                <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
                    📊 Dashboard
                </button>
                <button className={activeTab === 'clientes' ? 'active' : ''} onClick={() => setActiveTab('clientes')}>
                    👥 Clientes y Listas
                </button>
                <button className={activeTab === 'automatizaciones' ? 'active' : ''} onClick={() => setActiveTab('automatizaciones')}>
                    ⚙️ Automatizaciones
                </button>
                <button className={activeTab === 'campanas' ? 'active' : ''} onClick={() => setActiveTab('campanas')}>
                    🚀 Campañas
                </button>
                <button className={activeTab === 'retencion' ? 'active' : ''} onClick={() => setActiveTab('retencion')}>
                    🎯 Retención
                </button>
                <button className={activeTab === 'configuracion' ? 'active' : ''} onClick={() => setActiveTab('configuracion')}>
                    🛠️ Configuración
                </button>
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            {activeTab === 'dashboard' && (
                <div className="tab-pane">
                    {/* KPI Panel */}
                    <div className="crm-kpis">
                        <div className="kpi-card">
                            <h3>{stats.total}</h3>
                            <p>Contactos Registrados</p>
                        </div>
                        <div className="kpi-card vip">
                            <h3>{stats.porEstado.VIP || 0}</h3>
                            <p>Clientes VIP</p>
                        </div>
                        <div className="kpi-card active-crm">
                            <h3>{stats.porEstado.CLIENTE_ACTIVO + stats.porEstado.CLIENTE_FRECUENTE || 0}</h3>
                            <p>Clientes Activos</p>
                        </div>
                        <div className="kpi-card dormant">
                            <h3>{stats.porEstado.DORMIDO || 0}</h3>
                            <p>Clientes Dormidos</p>
                        </div>
                        <div className="kpi-card ticket">
                            <h3>{formatCurrency(stats.avgTicket)}</h3>
                            <p>Ticket Promedio</p>
                        </div>
                        <div className="kpi-card recovery-pct">
                            <h3>{stats.recoveryRate}%</h3>
                            <p>Tasa de Recuperación</p>
                        </div>
                    </div>

                    {/* Mid Section Graphs & Feeds */}
                    <div className="dashboard-grid">
                        {/* Users by State Graph (SVG Pure) */}
                        <div className="dashboard-card">
                            <h3>Distribución de Usuarios por Estado</h3>
                            <div className="state-chart-container">
                                {Object.entries(stats.porEstado).map(([state, count]) => {
                                    const pct = stats.total > 0 ? ((count / stats.total) * 100) : 0;
                                    return (
                                        <div key={state} className="chart-bar-row">
                                            <span className="state-label">{state}</span>
                                            <div className="bar-wrapper">
                                                <div className={`bar-fill state-${state.toLowerCase()}`} style={{ width: `${Math.max(3, pct)}%` }}></div>
                                                <span className="bar-value">{count} ({pct.toFixed(0)}%)</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Recent Events Feed */}
                        <div className="dashboard-card feed">
                            <h3>Eventos Recientes del CRM</h3>
                            <div className="events-feed-list">
                                {eventsLog.slice(0, 8).map(ev => {
                                    const u = usuarios.find(usr => usr.id === ev.usuario_id);
                                    return (
                                        <div key={ev.id} className="feed-item">
                                            <div className="feed-icon">💡</div>
                                            <div className="feed-info">
                                                <p>
                                                    <strong>{u?.nombre || 'Usuario desc.'}</strong> disparó event <code>{ev.event_type}</code>
                                                </p>
                                                <span>{formatDateStr(ev.created_at)} - {new Date(ev.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {eventsLog.length === 0 && <p className="empty">No hay eventos registrados en la base de datos.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Lower Section: Execution Logs */}
                    <div className="dashboard-card">
                        <h3>Registro de Automatizaciones Ejecutadas</h3>
                        <div className="table-responsive">
                            <table className="crm-simple-table">
                                <thead>
                                    <tr>
                                        <th>Fecha/Hora</th>
                                        <th>Cliente</th>
                                        <th>Detalle</th>
                                        <th>Canal</th>
                                        <th>Información</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyLog.filter(h => h.tipo === 'automatizacion_ejecutada').slice(0, 5).map(log => {
                                        const u = usuarios.find(usr => usr.id === log.usuario_id);
                                        return (
                                            <tr key={log.id}>
                                                <td>{formatDateStr(log.created_at)} {new Date(log.created_at).toLocaleTimeString()}</td>
                                                <td><strong>{u?.nombre || 'Desconocido'}</strong></td>
                                                <td>{log.descripcion}</td>
                                                <td><span className="badge-channel">{log.metadata?.channel || 'push'}</span></td>
                                                <td>Event: {log.metadata?.event_type || 'Pedido'}</td>
                                            </tr>
                                        );
                                    })}
                                    {historyLog.filter(h => h.tipo === 'automatizacion_ejecutada').length === 0 && (
                                        <tr><td colSpan="5" style={{ textAlign: 'center' }}>No hay automatizaciones ejecutadas recientemente.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CLIENTES */}
            {activeTab === 'clientes' && (
                <div className="tab-pane">
                    {/* Quick filter lists */}
                    <div className="quick-lists">
                        <span className="label">Listas Automáticas:</span>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('prospectos')}>Prospectos</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('registrado')}>Registrados</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('primer_pedido')}>Primer Pedido</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('cliente_activo')}>Activos</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('vip')}>VIPs</button>
                        <button className="btn-quick-list animate-pulse" onClick={() => handleQuickAccessList('dormido')}>Dormidos</button>
                        <button className="btn-quick-list" onClick={() => handleQuickAccessList('recuperado')}>Recuperados</button>
                    </div>

                    {/* Advanced filter panel */}
                    <div className="filters-panel">
                        <div className="filters-grid">
                            <div className="filter-item">
                                <label>Buscar Cliente</label>
                                <input 
                                    type="text" 
                                    placeholder="Nombre, email, teléfono..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="filter-item">
                                <label>Estado CRM</label>
                                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                    <option value="Todos">Todos los estados</option>
                                    <option value="VISITANTE">Visitante</option>
                                    <option value="REGISTRADO">Registrado</option>
                                    <option value="PRIMER_PEDIDO">Primer Pedido</option>
                                    <option value="CLIENTE_ACTIVO">Cliente Activo</option>
                                    <option value="CLIENTE_FRECUENTE">Cliente Frecuente</option>
                                    <option value="VIP">VIP</option>
                                    <option value="DORMIDO">Dormido</option>
                                    <option value="RECUPERADO">Recuperado</option>
                                </select>
                            </div>
                            <div className="filter-item">
                                <label>Ciudad</label>
                                <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                                    <option value="Todos">Todas las ciudades</option>
                                    <option value="Santo Tomé">Santo Tomé</option>
                                    <option value="Oberá">Oberá</option>
                                </select>
                            </div>
                            <div className="filter-item">
                                <label>Etiqueta</label>
                                <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                                    <option value="Todos">Cualquier etiqueta</option>
                                    {tags.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-item">
                                <label>Cat. Favorita</label>
                                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                                    <option value="Todos">Cualquier categoría</option>
                                    <option value="Helados">Helados</option>
                                    <option value="Farmacia">Farmacia</option>
                                    <option value="Shops">Shops</option>
                                    <option value="Pizzas">Pizzas</option>
                                    <option value="Hamburguesas">Hamburguesas</option>
                                    <option value="Lomitos">Lomitos</option>
                                    <option value="Empanadas">Empanadas</option>
                                    <option value="Bebidas">Bebidas</option>
                                </select>
                            </div>
                            <div className="filter-item">
                                <label>Score Wepi Mín.</label>
                                <input 
                                    type="number" 
                                    placeholder="Ej: 50"
                                    value={scoreMinFilter}
                                    onChange={(e) => setScoreMinFilter(e.target.value)}
                                />
                            </div>
                            <div className="filter-item">
                                <label>Inactividad</label>
                                <select value={inactivityDaysFilter} onChange={(e) => setInactivityDaysFilter(e.target.value)}>
                                    <option value="Todos">Cualquier período</option>
                                    <option value="7">7 a 14 días sin comprar</option>
                                    <option value="15">15 a 29 días sin comprar</option>
                                    <option value="30">30 a 59 días sin comprar</option>
                                    <option value="60">60 a 89 días sin comprar</option>
                                    <option value="90">Más de 90 días sin comprar</option>
                                </select>
                            </div>
                        </div>

                        {/* Bulk Action Controls */}
                        {selectedUsers.size > 0 && (
                            <div className="bulk-actions-wrapper">
                                <span><strong>{selectedUsers.size} seleccionados:</strong></span>
                                <div className="bulk-buttons">
                                    <select 
                                        className="select-action"
                                        onChange={(e) => {
                                            handleBulkTagAdd(e.target.value);
                                            e.target.value = '';
                                        }}
                                    >
                                        <option value="">Añadir etiqueta masiva...</option>
                                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <button 
                                        className="btn-bulk-campaign"
                                        onClick={() => {
                                            setCampaignForm(prev => ({
                                                ...prev,
                                                nombre: `Campaña Especial - ${selectedUsers.size} seleccionados`,
                                                filtros: { ...prev.filtros, tag: 'Todos' } // manual select overrides filters
                                            }));
                                            setActiveTab('campanas');
                                        }}
                                    >
                                        ✉️ Crear Campaña Especial
                                    </button>
                                    <button 
                                        className="btn-copy-phones"
                                        onClick={copySelectedPhones}
                                        style={{
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            padding: '7px 14px',
                                            borderRadius: '6px',
                                            fontWeight: '700',
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        📋 Copiar Teléfonos
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clientes Table */}
                    <div className="table-wrapper">
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
                                    <th>Ciudad</th>
                                    <th>Score Wepi</th>
                                    <th>Pedidos</th>
                                    <th>Total Gastado</th>
                                    <th>Ticket Prom.</th>
                                    <th>Último Pedido</th>
                                    <th>Favorito</th>
                                    <th>Estado CRM</th>
                                    <th>Etiquetas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => {
                                    const tagsJoined = user.crm_usuario_tags || [];
                                    return (
                                        <tr key={user.id} className="user-row">
                                            <td>
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedUsers.has(user.id)}
                                                    onChange={() => handleSelectUser(user.id)}
                                                />
                                            </td>
                                            <td>
                                                <div className="clickable-name" onClick={() => handleOpenUserDetail(user)}>
                                                    <strong>{user.nombre || 'Sin Nombre'}</strong>
                                                    <span>{user.telefono || '-'}</span>
                                                </div>
                                            </td>
                                            <td>{user.ciudad || 'Santo Tomé'}</td>
                                            <td>
                                                <span className="badge-score">{user.wepi_score || 0} pts</span>
                                            </td>
                                            <td><strong>{user.cantidad_pedidos || 0}</strong></td>
                                            <td>{formatCurrency(user.total_gastado)}</td>
                                            <td>{formatCurrency(user.ticket_promedio)}</td>
                                            <td>{formatDateStr(user.fecha_ultimo_pedido)}</td>
                                            <td><span className="badge-category">{user.categoria_favorita || '-'}</span></td>
                                            <td>
                                                <span className={`badge-crm state-${(user.estado_crm || 'REGISTRADO').toLowerCase()}`}>
                                                    {user.estado_crm || 'REGISTRADO'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="tag-badges-container">
                                                    {tagsJoined.map(t => {
                                                        const tagObj = tags.find(tag => tag.id === t.tag_id);
                                                        return (
                                                            <span key={t.tag_id} className="tag-badge">
                                                                {tagObj ? tagObj.name : t.tag_id}
                                                            </span>
                                                        );
                                                    })}
                                                    {tagsJoined.length === 0 && <span className="no-tags">-</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredUsers.length === 0 && (
                                    <tr><td colSpan="11" style={{ textAlign: 'center', padding: '30px' }}>No se encontraron usuarios que coincidan con los filtros.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: AUTOMATIZACIONES */}
            {activeTab === 'automatizaciones' && (
                <div className="tab-pane">
                    <div className="pane-header-actions">
                        <h2>Reglas de Automatización de CRM</h2>
                        <button className="btn-add" onClick={handleOpenNewAutomation}>
                            ➕ Nueva Automatización
                        </button>
                    </div>

                    <div className="automations-grid">
                        {automations.map(aut => (
                            <div key={aut.id} className={`automation-card ${aut.estado ? '' : 'inactive'}`}>
                                <div className="card-header">
                                    <h3>{aut.nombre}</h3>
                                    <div className="actions">
                                        <button className="btn-icon" onClick={() => handleOpenEditAutomation(aut)}>✏️</button>
                                        <button className="btn-icon delete" onClick={() => handleDeleteAutomation(aut.id)}>🗑️</button>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <p><strong>Disparador:</strong> <code>{aut.evento_disparador}</code></p>
                                    <p>
                                        <strong>Canal:</strong> 
                                        <span className="badge-channel">{aut.canal.toUpperCase()}</span>
                                    </p>
                                    <p><strong>Condiciones:</strong> 
                                        {Object.entries(aut.condiciones || {}).map(([k, v]) => (
                                            <span key={k} className="badge-condition">{k}: {v}</span>
                                        ))}
                                    </p>
                                    <p className="message-preview"><strong>Mensaje:</strong> "{aut.mensaje}"</p>
                                </div>
                                <div className="card-footer">
                                    <span>Espera: {aut.tiempo_espera} min | Prioridad: {aut.prioridad}</span>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={aut.estado} 
                                            onChange={() => handleToggleAutomationStatus(aut)}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                </div>
                            </div>
                        ))}
                        {automations.length === 0 && <p className="empty-state">No hay reglas de automatización creadas. Crea una nueva para comenzar.</p>}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CAMPAÑAS */}
            {activeTab === 'campanas' && (
                <div className="tab-pane">
                    <div className="campaign-workspace">
                        {/* Setup Form */}
                        <div className="campaign-setup-card">
                            <h2>Crear Nueva Campaña</h2>
                            <div className="form-group">
                                <label>Nombre de la Campaña</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Promo Oberá Helado Finde" 
                                    value={campaignForm.nombre}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, nombre: e.target.value }))}
                                />
                            </div>

                            <h3>Segmentación de Audiencia (Filtros)</h3>
                            <div className="filters-setup-grid">
                                <div className="form-group">
                                    <label>Ciudad</label>
                                    <select 
                                        value={campaignForm.filtros.ciudad}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, ciudad: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Todas las ciudades</option>
                                        <option value="Santo Tomé">Santo Tomé</option>
                                        <option value="Oberá">Oberá</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Estado CRM</label>
                                    <select 
                                        value={campaignForm.filtros.estado_crm}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, estado_crm: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Todos los estados</option>
                                        <option value="VISITANTE">Visitante</option>
                                        <option value="REGISTRADO">Registrado</option>
                                        <option value="PRIMER_PEDIDO">Primer Pedido</option>
                                        <option value="CLIENTE_ACTIVO">Cliente Activo</option>
                                        <option value="CLIENTE_FRECUENTE">Cliente Frecuente</option>
                                        <option value="VIP">VIP</option>
                                        <option value="DORMIDO">Dormido</option>
                                        <option value="RECUPERADO">Recuperado</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Etiqueta requerida</label>
                                    <select 
                                        value={campaignForm.filtros.tag}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, tag: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Cualquier etiqueta</option>
                                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Pedidos Mínimos</label>
                                    <input 
                                        type="number" 
                                        value={campaignForm.filtros.pedidos_min}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, pedidos_min: parseInt(e.target.value) || 0 } 
                                        }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Días Inactividad Mín.</label>
                                    <input 
                                        type="number" 
                                        value={campaignForm.filtros.dias_inactivo_min}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, dias_inactivo_min: parseInt(e.target.value) || 0 } 
                                        }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Score Wepi Mínimo</label>
                                    <input 
                                        type="number" 
                                        value={campaignForm.filtros.score_min}
                                        onChange={(e) => setCampaignForm(prev => ({ 
                                            ...prev, 
                                            filtros: { ...prev.filtros, score_min: parseInt(e.target.value) || 0 } 
                                        }))}
                                    />
                                </div>
                            </div>

                            <h3>Configuración de Mensaje</h3>
                            <div className="form-group">
                                <label>Canal Preferente (Intentará OneSignal Push primero, luego WhatsApp fallback)</label>
                                <select 
                                    value={campaignForm.canal}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, canal: e.target.value }))}
                                >
                                    <option value="push">Push Notification (OneSignal con WA fallback)</option>
                                    <option value="whatsapp">WhatsApp Direct (wa.me o Meta API)</option>
                                    <option value="email">Email</option>
                                    <option value="sms">SMS</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Contenido del Mensaje (Usa <code>[Nombre]</code> para personalizar)</label>
                                <textarea 
                                    rows="4" 
                                    placeholder="¡Hola [Nombre]! Te extrañamos en Wepi. Te dejamos un regalo..."
                                    value={campaignForm.mensaje}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, mensaje: e.target.value }))}
                                />
                            </div>

                            <div className="form-group">
                                <label>Programar Fecha y Hora (Dejar vacío para enviar de inmediato)</label>
                                <input 
                                    type="datetime-local" 
                                    value={campaignForm.fecha_programada}
                                    onChange={(e) => setCampaignForm(prev => ({ ...prev, fecha_programada: e.target.value }))}
                                />
                            </div>

                            <div className="audience-estimation">
                                <p>Usuarios seleccionados para envío: <strong>{targetedCampaignUsersCount}</strong></p>
                            </div>

                            <button className="btn-launch" onClick={handleLaunchCampaign}>
                                {campaignForm.fecha_programada ? '📅 Programar Campaña' : '🚀 Enviar Campaña Ahora'}
                            </button>
                        </div>

                        {/* History list */}
                        <div className="campaign-history-card">
                            <h2>Campañas Lanzadas</h2>
                            <div className="campaigns-list">
                                {campaigns.map(camp => (
                                    <div key={camp.id} className="campaign-item">
                                        <div className="camp-header">
                                            <h4>{camp.nombre}</h4>
                                            <button className="btn-small btn-delete" onClick={() => handleDeleteCampaign(camp.id)}>Eliminar</button>
                                        </div>
                                        <p className="desc">"{camp.mensaje}"</p>
                                        <div className="meta">
                                            <span>Canal: <strong style={{ textTransform: 'uppercase' }}>{camp.canal}</strong></span>
                                            <span className={`status-badge ${camp.estado?.toLowerCase()}`}>{camp.estado}</span>
                                            {camp.fecha_programada && <span>Programada: {formatDateStr(camp.fecha_programada)}</span>}
                                        </div>
                                    </div>
                                ))}
                                {campaigns.length === 0 && <p className="empty">No hay registro de campañas anteriores.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: RETENCION */}
            {activeTab === 'retencion' && (
                <div className="tab-pane">
                    <div className="retention-info-box">
                        <h2>Embudo de Retención e Inactividad</h2>
                        <p>Visualiza segmentos de clientes dormidos de forma rápida, evalúa tasas de conversión de recuperación y realiza acciones masivas.</p>
                    </div>

                    <div className="retention-cohorts-container">
                        {retentionCohorts.map(coh => (
                            <div key={coh.id} className="cohort-row">
                                <div className="cohort-meta">
                                    <h3>{coh.label}</h3>
                                    <span>Clientes: <strong>{coh.count}</strong></span>
                                </div>
                                <div className="cohort-stats">
                                    <div className="cohort-stat-box">
                                        <span>Mensajes enviados</span>
                                        <strong>{coh.messagesSent}</strong>
                                    </div>
                                    <div className="cohort-stat-box">
                                        <span>Tasa de Recuperación</span>
                                        <strong style={{ color: Number(coh.rate) > 0 ? '#10b981' : '#64748b' }}>{coh.rate}%</strong>
                                    </div>
                                </div>
                                <div className="cohort-actions">
                                    <button className="btn-cohort secondary" onClick={() => handleFilterCohort(coh.id)}>
                                        🔍 Ver Clientes
                                    </button>
                                    <button className="btn-cohort" onClick={() => handlePrepopulateCohortCampaign(coh.id)}>
                                        ✉️ Alertar Segmento
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CONFIGURACION */}
            {activeTab === 'configuracion' && (
                <div className="tab-pane">
                    <div className="config-grid">
                        {/* Dynamic Tags setup */}
                        <div className="config-card">
                            <h2>Administrador de Etiquetas (Tags)</h2>
                            <p className="desc">Las etiquetas clasifican los gustos, horarios y ubicaciones de tus clientes de forma dinámica.</p>
                            
                            <div className="add-tag-form">
                                <input 
                                    type="text" 
                                    placeholder="ID única (Ej: SANTO_TOME, VEGANO)" 
                                    value={newTagIdInput}
                                    onChange={(e) => setNewTagIdInput(e.target.value)}
                                />
                                <input 
                                    type="text" 
                                    placeholder="Nombre legible (Ej: Santo Tomé, Vegano)" 
                                    value={newTagInput}
                                    onChange={(e) => setNewTagInput(e.target.value)}
                                />
                                <button className="btn-save" onClick={handleCreateTag}>Registrar Etiqueta</button>
                            </div>

                            <div className="tags-management-list">
                                {tags.map(t => (
                                    <div key={t.id} className="tag-mgmt-item">
                                        <span><strong>{t.name}</strong> (<code>{t.id}</code>)</span>
                                        <button className="btn-small btn-delete" onClick={() => handleDeleteTag(t.id)}>Eliminar</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Score Weights config */}
                        <div className="config-card">
                            <h2>Pesos del Score Wepi</h2>
                            <p className="desc">Ajusta los puntos asignados a las acciones de los usuarios para el cálculo de su fidelización.</p>

                            <div className="score-weights-form">
                                {scoreConfig.map(cfg => (
                                    <div key={cfg.id} className="score-weight-row">
                                        <label>{cfg.nombre} (<code>{cfg.id}</code>)</label>
                                        <input 
                                            type="number" 
                                            value={cfg.puntos}
                                            onChange={(e) => handleUpdateScoreWeight(cfg.id, e.target.value)}
                                        />
                                    </div>
                                ))}
                                <button className="btn-save-weights" onClick={handleSaveScoreWeights}>
                                    💾 Guardar Configuraciones del Score
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* USER DETAIL MODAL (FICHA DEL CLIENTE) */}
            {selectedUserDetail && (
                <div className="crm-modal-overlay" onClick={() => setSelectedUserDetail(null)}>
                    <div className="crm-modal-content user-ficha" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Ficha de Cliente: {selectedUserDetail.nombre || 'Sin nombre'}</h2>
                            <button className="close-btn" onClick={() => setSelectedUserDetail(null)}>&times;</button>
                        </div>
                        <div className="modal-body-split">
                            {/* Profile details */}
                            <div className="profile-details-column">
                                <div className="avatar-header">
                                    <div className="avatar">{(selectedUserDetail.nombre || 'U').substring(0, 1)}</div>
                                    <div className="sub">
                                        <span className={`badge-crm state-${(selectedUserDetail.estado_crm || 'REGISTRADO').toLowerCase()}`}>
                                            {selectedUserDetail.estado_crm || 'REGISTRADO'}
                                        </span>
                                        <span className="badge-score">{selectedUserDetail.wepi_score || 0} pts</span>
                                    </div>
                                </div>

                                <div className="details-info-list">
                                    <p><strong>Teléfono:</strong> {selectedUserDetail.telefono || '-'}</p>
                                    <p><strong>Email:</strong> {selectedUserDetail.email || '-'}</p>
                                    <p><strong>Ciudad:</strong> {selectedUserDetail.ciudad || 'Santo Tomé'}</p>
                                    <p><strong>Fecha Registro:</strong> {formatDateStr(selectedUserDetail.created_at)}</p>
                                    <p><strong>Primer Pedido:</strong> {formatDateStr(selectedUserDetail.fecha_primer_pedido)}</p>
                                    <p><strong>Último Pedido:</strong> {formatDateStr(selectedUserDetail.fecha_ultimo_pedido)}</p>
                                    <p><strong>Pedidos Entregados:</strong> {selectedUserDetail.cantidad_pedidos || 0}</p>
                                    <p><strong>Total Gastado:</strong> {formatCurrency(selectedUserDetail.total_gastado)}</p>
                                    <p><strong>Ticket Promedio:</strong> {formatCurrency(selectedUserDetail.ticket_promedio)}</p>
                                    <p><strong>Categoría Favorita:</strong> <span className="badge-category">{selectedUserDetail.categoria_favorita || '-'}</span></p>
                                </div>

                                {/* Dynamic Tag links inside Ficha */}
                                <div className="ficha-tags-section">
                                    <h4>Etiquetas del Usuario</h4>
                                    <div className="active-tags-grid">
                                        {(selectedUserDetail.crm_usuario_tags || []).map(t => {
                                            const tagObj = tags.find(tg => tg.id === t.tag_id);
                                            return (
                                                <span key={t.tag_id} className="active-tag-chip">
                                                    {tagObj ? tagObj.name : t.tag_id}
                                                    <button onClick={() => handleRemoveUserTag(selectedUserDetail.id, t.tag_id)}>&times;</button>
                                                </span>
                                            );
                                        })}
                                        {(selectedUserDetail.crm_usuario_tags || []).length === 0 && <p className="empty-text">Sin etiquetas.</p>}
                                    </div>

                                    {/* Link new tag */}
                                    <select 
                                        className="select-add-tag"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddUserTag(selectedUserDetail.id, e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                    >
                                        <option value="">Añadir etiqueta...</option>
                                        {tags.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Direct interaction */}
                                <div className="ficha-direct-send-section">
                                    <h4>Enviar Mensaje de CRM</h4>
                                    <div className="form-group">
                                        <label>Canal Preferido</label>
                                        <select 
                                            value={selectedUserTemplateChannel}
                                            onChange={(e) => setSelectedUserTemplateChannel(e.target.value)}
                                        >
                                            <option value="push">Push Notification (OneSignal / Fallback WA)</option>
                                            <option value="whatsapp">WhatsApp Direct (wa.me o Meta API)</option>
                                            <option value="email">Email</option>
                                            <option value="sms">SMS</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Mensaje (Soporta [Nombre])</label>
                                        <textarea 
                                            rows="3" 
                                            placeholder="Escribe tu mensaje..."
                                            value={selectedUserTemplateText}
                                            onChange={(e) => setSelectedUserTemplateText(e.target.value)}
                                        />
                                    </div>
                                    <button className="btn-send" onClick={handleSendDirectMessage}>
                                        ✉️ Despachar Mensaje
                                    </button>
                                </div>
                            </div>

                            {/* Timeline Log */}
                            <div className="timeline-log-column">
                                <h3>Historial y Actividades CRM</h3>
                                <div className="timeline-container">
                                    {/* Merge history and events into chronological timeline */}
                                    {useMemo(() => {
                                        const merged = [];
                                        userDetailHistory.forEach(h => merged.push({ ...h, type: 'history' }));
                                        userDetailEvents.forEach(e => merged.push({ ...e, type: 'event' }));
                                        return merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                                    }, [userDetailHistory, userDetailEvents]).map((log, idx) => {
                                        if (log.type === 'event') {
                                            return (
                                                <div key={`ev-${log.id}-${idx}`} className="timeline-item event">
                                                    <div className="time-badge">{formatDateStr(log.created_at)} {new Date(log.created_at).toLocaleTimeString().substring(0, 5)}</div>
                                                    <div className="timeline-content">
                                                        <span className="type">EVENTO: <code>{log.event_type}</code></span>
                                                        {log.metadata && <span className="meta">{JSON.stringify(log.metadata)}</span>}
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div key={`hist-${log.id}-${idx}`} className={`timeline-item history ${log.tipo}`}>
                                                    <div className="time-badge">{formatDateStr(log.created_at)} {new Date(log.created_at).toLocaleTimeString().substring(0, 5)}</div>
                                                    <div className="timeline-content">
                                                        <span className="type">ACCION: {log.tipo.toUpperCase()}</span>
                                                        <p className="desc">{log.descripcion}</p>
                                                        {log.canal && <span className="channel">Canal: {log.canal}</span>}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    })}
                                    {userDetailHistory.length === 0 && userDetailEvents.length === 0 && (
                                        <p className="empty">Sin actividades de CRM registradas en el perfil.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AUTOMATION EDIT MODAL */}
            {showAutomationModal && (
                <div className="crm-modal-overlay" onClick={() => setShowAutomationModal(false)}>
                    <div className="crm-modal-content form-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{activeAutomation ? 'Editar Automatización' : 'Nueva Automatización'}</h2>
                            <button className="close-btn" onClick={() => setShowAutomationModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body-vertical">
                            <div className="form-group">
                                <label>Nombre de la regla</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Bienvenida Santo Tomé"
                                    value={automationForm.nombre}
                                    onChange={(e) => setAutomationForm(prev => ({ ...prev, nombre: e.target.value }))}
                                />
                            </div>

                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>Evento Disparador</label>
                                    <select 
                                        value={automationForm.evento_disparador}
                                        onChange={(e) => setAutomationForm(prev => ({ ...prev, evento_disparador: e.target.value }))}
                                    >
                                        <option value="USER_REGISTERED">USER_REGISTERED (Registro de usuario)</option>
                                        <option value="FIRST_ORDER">FIRST_ORDER (Primer pedido)</option>
                                        <option value="SECOND_ORDER">SECOND_ORDER (Segundo pedido)</option>
                                        <option value="THIRD_ORDER">THIRD_ORDER (Tercer pedido)</option>
                                        <option value="FIFTH_ORDER">FIFTH_ORDER (Quinto pedido)</option>
                                        <option value="VIP_REACHED">VIP_REACHED (VIP alcanzado)</option>
                                        <option value="ORDER_CANCELLED">ORDER_CANCELLED (Pedido cancelado)</option>
                                        <option value="USER_DORMANT_7">USER_DORMANT_7 (7 días inactivo)</option>
                                        <option value="USER_DORMANT_15">USER_DORMANT_15 (15 días inactivo)</option>
                                        <option value="USER_DORMANT_30">USER_DORMANT_30 (30 días inactivo/Dormido)</option>
                                        <option value="USER_RECOVERED">USER_RECOVERED (Cliente recuperado)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Canal Preferente</label>
                                    <select 
                                        value={automationForm.canal}
                                        onChange={(e) => setAutomationForm(prev => ({ ...prev, canal: e.target.value }))}
                                    >
                                        <option value="push">Push Notification (Con fallback a WA)</option>
                                        <option value="whatsapp">WhatsApp Direct (wa.me o API)</option>
                                        <option value="email">Email</option>
                                        <option value="sms">SMS</option>
                                    </select>
                                </div>
                            </div>

                            <h3>Condiciones de Aplicación</h3>
                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>Ciudad</label>
                                    <select 
                                        value={automationForm.condiciones.ciudad}
                                        onChange={(e) => setAutomationForm(prev => ({ 
                                            ...prev, 
                                            condiciones: { ...prev.condiciones, ciudad: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Todas las ciudades</option>
                                        <option value="Santo Tomé">Santo Tomé</option>
                                        <option value="Oberá">Oberá</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Categoría Favorita</label>
                                    <select 
                                        value={automationForm.condiciones.categoria_favorita}
                                        onChange={(e) => setAutomationForm(prev => ({ 
                                            ...prev, 
                                            condiciones: { ...prev.condiciones, categoria_favorita: e.target.value } 
                                        }))}
                                    >
                                        <option value="Todos">Cualquiera</option>
                                        <option value="Helados">Helados</option>
                                        <option value="Farmacia">Farmacia</option>
                                        <option value="Shops">Shops</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Mensaje del Disparador (Usa <code>[Nombre]</code>)</label>
                                <textarea 
                                    rows="4" 
                                    placeholder="¡Hola [Nombre]! Gracias por tu registro..."
                                    value={automationForm.mensaje}
                                    onChange={(e) => setAutomationForm(prev => ({ ...prev, mensaje: e.target.value }))}
                                />
                            </div>

                            <div className="form-group-row">
                                <div className="form-group">
                                    <label>Tiempo de espera (minutos)</label>
                                    <input 
                                        type="number" 
                                        value={automationForm.tiempo_espera}
                                        onChange={(e) => setAutomationForm(prev => ({ ...prev, tiempo_espera: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Prioridad</label>
                                    <input 
                                        type="number" 
                                        value={automationForm.prioridad}
                                        onChange={(e) => setAutomationForm(prev => ({ ...prev, prioridad: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                                <input 
                                    type="checkbox" 
                                    id="aut-form-estado"
                                    checked={automationForm.estado}
                                    onChange={(e) => setAutomationForm(prev => ({ ...prev, estado: e.target.checked }))}
                                />
                                <label htmlFor="aut-form-estado" style={{ margin: 0 }}>Habilitada (Activa)</label>
                            </div>

                            <div className="form-buttons">
                                <button className="btn-cancel" onClick={() => setShowAutomationModal(false)}>Cancelar</button>
                                <button className="btn-confirm" onClick={handleSaveAutomation}>💾 Guardar Regla</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCRM;
