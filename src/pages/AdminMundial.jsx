import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminMundial = () => {
    const [activeSubTab, setActiveSubTab] = useState('config');
    const [loading, setLoading] = useState(true);
    
    // Core States
    const [config, setConfig] = useState(null);
    const [partidos, setPartidos] = useState([]);
    const [calendario, setCalendario] = useState([]);
    const [figuritas, setFiguritas] = useState([]);
    const [walletCampaigns, setWalletCampaigns] = useState([]);

    // Forms
    const [editingPartido, setEditingPartido] = useState(null);
    const [partidoForm, setPartidoForm] = useState({
        equipo_a: '', equipo_b: '', bandera_a: '', bandera_b: '',
        fecha_partido: '', goles_a: '', goles_b: '', estado: 'pendiente',
        fase: 'Fase de Grupos'
    });

    const [editingFigurita, setEditingFigurita] = useState(null);
    const [figuritaForm, setFiguritaForm] = useState({
        nombre: '', categoria: 'Argentina', rareza: 'comun', foto_url: ''
    });

    const [editingDia, setEditingDia] = useState(null);
    const [diaForm, setDiaForm] = useState({
        premio_tipo: 'puntos', premio_cantidad: 50, campaign_id: '', descripcion: ''
    });

    // Misiones States
    const [adminMisiones, setAdminMisiones] = useState([]);
    const [editingMision, setEditingMision] = useState(null);
    const [misionForm, setMisionForm] = useState({
        titulo: '', descripcion: '', puntos_premio: 50, sobres_premio: 0, tipo: 'imagen_verificacion', fecha: new Date().toISOString().substring(0, 10), enlace_url: ''
    });

    // Cupones States
    const [cupones, setCupones] = useState([]);
    const [editingCupon, setEditingCupon] = useState(null);
    const [cuponForm, setCuponForm] = useState({
        codigo: '', premio_tipo: 'puntos', premio_cantidad: 100, figurita_numero: '', limite_usos: 100, activo: true
    });

    // Inyector de Puntos States
    const [usersList, setUsersList] = useState([]);
    const [searchUserQuery, setSearchUserQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [injectForm, setInjectForm] = useState({
        premio_tipo: 'puntos', premio_cantidad: 100, figurita_numero: '', motivo: ''
    });
    // Helper: Render flag as image if it's a URL, or as emoji/text otherwise
    const renderFlag = (flag) => {
        if (!flag) return '🏳️';
        if (flag.startsWith('http://') || flag.startsWith('https://')) {
            return (
                <img 
                    src={flag} 
                    alt="flag" 
                    className="flag-img-render" 
                    style={{ 
                        width: '28px', 
                        height: '18px', 
                        objectFit: 'cover', 
                        borderRadius: '3px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        verticalAlign: 'middle'
                    }} 
                />
            );
        }
        return <span style={{ fontSize: '1.2rem', verticalAlign: 'middle' }}>{flag}</span>;
    };

    // Helper: Format date forcing UTC and 24h to avoid offset issues
    const formatMatchDate = (dateString) => {
        try {
            const d = new Date(dateString);
            return d.toLocaleString('es-AR', {
                timeZone: 'UTC',
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(',', '');
        } catch (e) {
            return dateString;
        }
    };

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // Load Mundial Config
            const conf = await api.getMundialConfig();
            setConfig(conf || {
                streak_3_premio_tipo: 'puntos', streak_3_premio_cantidad: 50, streak_3_campaign_id: null,
                streak_7_premio_tipo: 'credito_wallet', streak_7_premio_cantidad: 200, streak_7_campaign_id: null,
                album_completado_campaign_id: null
            });

            // Load Partidos
            const pts = await api.getMundialPartidos();
            setPartidos(pts);

            // Load Calendario
            const { data: cal } = await supabase
                .from('mundial_calendario_premios')
                .select('*')
                .order('dia', { ascending: true });
            setCalendario(cal || []);

            // Load Figuritas
            const figs = await api.getMundialFiguritas();
            setFiguritas(figs);

            // Load Wallet Campaigns
            const camps = await api.adminGetWalletCampaigns();
            setWalletCampaigns(camps || []);

            // Load Misiones
            const { data: mis } = await supabase
                .from('mundial_misiones')
                .select('*')
                .order('fecha', { ascending: false });
            setAdminMisiones(mis || []);

            // Load Cupones
            const { data: cup } = await supabase
                .from('mundial_cupones')
                .select('*')
                .order('created_at', { ascending: false });
            setCupones(cup || []);

            // Load Users List
            const { data: usr } = await supabase
                .from('usuarios')
                .select('id, nombre, email')
                .order('nombre', { ascending: true });
            setUsersList(usr || []);

        } catch (err) {
            toast.error('Error al cargar datos del Mundial');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- CONFIG ACTIONS ---
    const handleSaveConfig = async (e) => {
        e.preventDefault();
        try {
            await api.updateMundialConfig(config);
            toast.success('Configuración guardada correctamente');
            loadAllData();
        } catch (err) {
            toast.error('Error al guardar configuración');
            console.error(err);
        }
    };

    // --- PARTIDOS ACTIONS ---
    const handleSavePartido = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...partidoForm,
                goles_a: partidoForm.goles_a !== '' ? Number(partidoForm.goles_a) : null,
                goles_b: partidoForm.goles_b !== '' ? Number(partidoForm.goles_b) : null
            };
            if (editingPartido) payload.id = editingPartido.id;

            await api.adminSavePartido(payload);
            toast.success(editingPartido ? 'Partido actualizado' : 'Partido creado');
            setEditingPartido(null);
            setPartidoForm({
                equipo_a: '', equipo_b: '', bandera_a: '', bandera_b: '',
                fecha_partido: '', goles_a: '', goles_b: '', estado: 'pendiente',
                fase: 'Fase de Grupos'
            });
            loadAllData();
        } catch (err) {
            toast.error('Error al guardar partido');
            console.error(err);
        }
    };

    const handleEditPartido = (partido) => {
        setEditingPartido(partido);
        setPartidoForm({
            equipo_a: partido.equipo_a,
            equipo_b: partido.equipo_b,
            bandera_a: partido.bandera_a || '',
            bandera_b: partido.bandera_b || '',
            fecha_partido: new Date(partido.fecha_partido).toISOString().substring(0, 16),
            goles_a: partido.goles_a !== null ? partido.goles_a : '',
            goles_b: partido.goles_b !== null ? partido.goles_b : '',
            estado: partido.estado,
            fase: partido.fase || 'Fase de Grupos'
        });
    };

    const handleDeletePartido = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar este partido? Todos los pronósticos asociados se borrarán.')) return;
        try {
            await api.adminDeletePartido(id);
            toast.success('Partido eliminado');
            loadAllData();
        } catch (err) {
            toast.error('Error al eliminar partido');
        }
    };

    // --- CALENDARIO ACTIONS ---
    const handleSaveDia = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('mundial_calendario_premios')
                .update({
                    premio_tipo: diaForm.premio_tipo,
                    premio_cantidad: Number(diaForm.premio_cantidad),
                    campaign_id: diaForm.campaign_id || null,
                    descripcion: diaForm.descripcion
                })
                .eq('dia', editingDia);

            if (error) throw error;
            toast.success(`Día ${editingDia} configurado correctamente`);
            setEditingDia(null);
            loadAllData();
        } catch (err) {
            toast.error('Error al guardar día del calendario');
            console.error(err);
        }
    };

    const handleEditDia = (diaItem) => {
        setEditingDia(diaItem.dia);
        setDiaForm({
            premio_tipo: diaItem.premio_tipo,
            premio_cantidad: diaItem.premio_cantidad,
            campaign_id: diaItem.campaign_id || '',
            descripcion: diaItem.descripcion || ''
        });
    };

    // --- MISIONES ACTIONS ---
    const handleSaveMision = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                titulo: misionForm.titulo,
                descripcion: misionForm.descripcion,
                puntos_premio: Number(misionForm.puntos_premio),
                sobres_premio: Number(misionForm.sobres_premio || 0),
                tipo: misionForm.tipo,
                fecha: misionForm.fecha,
                enlace_url: misionForm.tipo === 'link_verificacion' ? misionForm.enlace_url : null
            };
            if (editingMision) {
                const { error } = await supabase
                    .from('mundial_misiones')
                    .update(payload)
                    .eq('id', editingMision.id);
                if (error) throw error;
                toast.success('Misión actualizada correctamente');
            } else {
                const { error } = await supabase
                    .from('mundial_misiones')
                    .insert(payload);
                if (error) throw error;
                toast.success('Misión creada correctamente');
            }
            setEditingMision(null);
            setMisionForm({
                titulo: '', descripcion: '', puntos_premio: 50, sobres_premio: 0, tipo: 'imagen_verificacion', fecha: new Date().toISOString().substring(0, 10), enlace_url: ''
            });
            loadAllData();
        } catch (err) {
            toast.error('Error al guardar misión');
            console.error(err);
        }
    };

    const handleEditMision = (m) => {
        setEditingMision(m);
        setMisionForm({
            titulo: m.titulo,
            descripcion: m.descripcion,
            puntos_premio: m.puntos_premio,
            sobres_premio: m.sobres_premio || 0,
            tipo: m.tipo,
            fecha: m.fecha,
            enlace_url: m.enlace_url || ''
        });
    };

    const handleDeleteMision = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar esta misión?')) return;
        try {
            const { error } = await supabase
                .from('mundial_misiones')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Misión eliminada');
            loadAllData();
        } catch (err) {
            toast.error('Error al eliminar misión');
        }
    };

    // --- CUPONES ACTIONS ---
    const handleSaveCupon = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                codigo: cuponForm.codigo.trim().toUpperCase(),
                premio_tipo: cuponForm.premio_tipo,
                premio_cantidad: Number(cuponForm.premio_cantidad),
                figurita_numero: cuponForm.premio_tipo === 'figurita_especifica' ? Number(cuponForm.figurita_numero) : null,
                limite_usos: Number(cuponForm.limite_usos),
                activo: cuponForm.activo
            };

            if (editingCupon) {
                const { error } = await supabase
                    .from('mundial_cupones')
                    .update(payload)
                    .eq('codigo', editingCupon.codigo);
                if (error) throw error;
                toast.success('Cupón de canje actualizado');
            } else {
                const { error } = await supabase
                    .from('mundial_cupones')
                    .insert(payload);
                if (error) throw error;
                toast.success('Cupón de canje creado');
            }
            setEditingCupon(null);
            setCuponForm({
                codigo: '', premio_tipo: 'puntos', premio_cantidad: 100, figurita_numero: '', limite_usos: 100, activo: true
            });
            loadAllData();
        } catch (err) {
            toast.error('Error al guardar cupón. Asegúrate de que el código no esté duplicado.');
            console.error(err);
        }
    };

    const handleEditCupon = (cup) => {
        setEditingCupon(cup);
        setCuponForm({
            codigo: cup.codigo,
            premio_tipo: cup.premio_tipo,
            premio_cantidad: cup.premio_cantidad,
            figurita_numero: cup.figurita_numero || '',
            limite_usos: cup.limite_usos,
            activo: cup.activo
        });
    };

    const handleDeleteCupon = async (codigo) => {
        if (!window.confirm('¿Seguro que deseas eliminar este cupón?')) return;
        try {
            const { error } = await supabase
                .from('mundial_cupones')
                .delete()
                .eq('codigo', codigo);
            if (error) throw error;
            toast.success('Cupón eliminado');
            loadAllData();
        } catch (err) {
            toast.error('Error al eliminar cupón');
        }
    };

    // --- INYECTOR DE PREMIOS ACTIONS ---
    const handleInjectRewards = async (e) => {
        e.preventDefault();
        if (!selectedUser) {
            toast.error('Selecciona un usuario de la lista.');
            return;
        }

        const qty = Number(injectForm.premio_cantidad);

        try {
            if (injectForm.premio_tipo === 'puntos') {
                // Fetch stats points
                const { data: st } = await supabase
                    .from('mundial_usuario_stats')
                    .select('puntos_totales')
                    .eq('usuario_id', selectedUser.id)
                    .single();
                const newPoints = (st ? st.puntos_totales : 0) + qty;
                const { error: saveErr } = await supabase
                    .from('mundial_usuario_stats')
                    .upsert({ usuario_id: selectedUser.id, puntos_totales: newPoints });
                if (saveErr) throw saveErr;
                toast.success(`Se agregaron +${qty} puntos a ${selectedUser.nombre}!`);
            } else if (injectForm.premio_tipo === 'sobre_figuritas') {
                const { data: st } = await supabase
                    .from('mundial_usuario_stats')
                    .select('sobres_disponibles')
                    .eq('usuario_id', selectedUser.id)
                    .single();
                const newSobres = (st ? st.sobres_disponibles : 0) + qty;
                const { error: saveErr } = await supabase
                    .from('mundial_usuario_stats')
                    .upsert({ usuario_id: selectedUser.id, sobres_disponibles: newSobres });
                if (saveErr) throw saveErr;
                toast.success(`Se agregaron +${qty} sobres a ${selectedUser.nombre}!`);
            } else if (injectForm.premio_tipo === 'figurita_especifica') {
                const figNum = Number(injectForm.figurita_numero);
                const { data: fig } = await supabase
                    .from('mundial_figuritas')
                    .select('id, nombre')
                    .eq('numero', figNum)
                    .single();
                
                if (!fig) {
                    toast.error(`La figurita #${figNum} no existe en el catálogo.`);
                    return;
                }

                // Check if user already has it
                const { data: uFig } = await supabase
                    .from('mundial_usuario_figuritas')
                    .select('id, cantidad')
                    .eq('usuario_id', selectedUser.id)
                    .eq('figurita_id', fig.id)
                    .maybeSingle();

                const newQty = (uFig ? uFig.cantidad : 0) + 1;
                const { error: saveErr } = await supabase
                    .from('mundial_usuario_figuritas')
                    .upsert({ 
                        usuario_id: selectedUser.id, 
                        figurita_id: fig.id, 
                        cantidad: newQty, 
                        pegada: false 
                    });
                if (saveErr) throw saveErr;
                toast.success(`Se entregó la figurita #${figNum} (${fig.nombre}) a ${selectedUser.nombre}!`);
            }

            // Reset injection form
            setInjectForm({ premio_tipo: 'puntos', premio_cantidad: 100, figurita_numero: '', motivo: '' });
            setSelectedUser(null);
            loadAllData();
        } catch (err) {
            toast.error('Error al inyectar premios.');
            console.error(err);
        }
    };

    // --- FIGURITAS ACTIONS ---
    const handleSaveFigurita = async (e) => {
        e.preventDefault();
        try {
            await api.adminSaveFigurita({
                id: editingFigurita.id,
                ...figuritaForm
            });
            toast.success(`Figurita #${editingFigurita.numero} guardada`);
            setEditingFigurita(null);
            loadAllData();
        } catch (err) {
            toast.error('Error al guardar figurita');
            console.error(err);
        }
    };

    const handleEditFigurita = (fig) => {
        setEditingFigurita(fig);
        setFiguritaForm({
            nombre: fig.nombre,
            categoria: fig.categoria,
            rareza: fig.rareza,
            foto_url: fig.foto_url || ''
        });
    };

    if (loading) return <div className="loading-state">Cargando módulo Mundial...</div>;

    return (
        <div className="panel-card animate-fade-in" style={{ backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}>
            <header className="panel-header" style={{ borderBottom: '1px solid #334155' }}>
                <h2 style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🏆 Campaña Mundialista - Configuración
                </h2>
                <div className="sub-tabs-mundial" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className={`btn ${activeSubTab === 'config' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveSubTab('config')}>
                        ⚙️ Config
                    </button>
                    <button className={`btn ${activeSubTab === 'partidos' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveSubTab('partidos')}>
                        ⚽ Partidos
                    </button>
                    <button className={`btn ${activeSubTab === 'calendario' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveSubTab('calendario')}>
                        📅 Calendario
                    </button>
                    <button className={`btn ${activeSubTab === 'misiones' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveSubTab('misiones')}>
                        ⚡ Misiones ({adminMisiones.length})
                    </button>
                    <button className={`btn ${activeSubTab === 'cupones' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveSubTab('cupones')}>
                        🎟️ Cupones ({cupones.length})
                    </button>
                    <button className={`btn ${activeSubTab === 'usuarios' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveSubTab('usuarios')}>
                        👤 Inyector Puntos
                    </button>
                    <button className={`btn ${activeSubTab === 'figuritas' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveSubTab('figuritas')}>
                        🖼️ Figuritas ({figuritas.length})
                    </button>
                </div>
            </header>

            <div className="panel-body" style={{ padding: '20px' }}>
                {/* 1. SECCION CONFIG */}
                {activeSubTab === 'config' && config && (
                    <form onSubmit={handleSaveConfig} className="form-grid-mundial">

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>📚 Premio Álbum Completado</h3>
                            <div>
                                <label>Campaña de Billetera por Completar el Álbum</label>
                                <select 
                                    className="filter-input-dark"
                                    value={config.album_completado_campaign_id || ''}
                                    onChange={e => setConfig({...config, album_completado_campaign_id: e.target.value || null})}
                                    style={{ maxWidth: '400px' }}
                                >
                                    <option value="">-- Sin campaña asignada --</option>
                                    {walletCampaigns.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} (Crédito por Completar)</option>
                                    ))}
                                </select>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px' }}>El usuario recibirá el beneficio configurado en esta campaña apenas pegue la figurita #39 en su álbum.</p>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>📢 Banner de Campaña Mundialista</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Imagen del Banner (URL)</label>
                                    <input 
                                        type="text" 
                                        className="filter-input-dark"
                                        placeholder="Ej: https://i.postimg.cc/...png"
                                        value={config.banner_url || ''}
                                        onChange={e => setConfig({...config, banner_url: e.target.value || null})}
                                        style={{ width: '100%', maxWidth: '600px' }}
                                    />
                                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>Esta imagen se mostrará en la parte superior de la Campaña Mundialista.</p>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Enlace del Banner (Opcional)</label>
                                    <input 
                                        type="text" 
                                        className="filter-input-dark"
                                        placeholder="Ej: https://wepi.delivery/promos"
                                        value={config.banner_link || ''}
                                        onChange={e => setConfig({...config, banner_link: e.target.value || null})}
                                        style={{ width: '100%', maxWidth: '600px' }}
                                    />
                                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>Enlace web externo o interno al que se redirigirá al usuario cuando haga clic en el banner.</p>
                                </div>
                                {config.banner_url && (
                                    <div style={{ marginTop: '10px' }}>
                                        <label style={{ display: 'block', marginBottom: '5px', color: '#fbbf24', fontWeight: 'bold' }}>Vista Previa:</label>
                                        <img 
                                            src={config.banner_url} 
                                            alt="Vista previa del banner" 
                                            style={{ width: '100%', maxWidth: '600px', height: 'auto', borderRadius: '8px', border: '1px solid #334155' }} 
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                            Guardar Configuración
                        </button>
                    </form>
                )}

                {/* 2. SECCION PARTIDOS */}
                {activeSubTab === 'partidos' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                        <div>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>Lista de Partidos</h3>
                            <div className="table-responsive">
                                <table className="admin-table-dark">
                                    <thead>
                                        <tr>
                                            <th>Partido</th>
                                            <th>Fase</th>
                                            <th>Fecha</th>
                                            <th>Marcador Real</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {partidos.length === 0 ? (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No hay partidos agregados.</td></tr>
                                        ) : (
                                            partidos.map(p => (
                                                <tr key={p.id} style={{ borderBottom: '1px solid #334155' }}>
                                                    <td style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px' }}>
                                                        <span>{renderFlag(p.bandera_a)}</span>
                                                        <strong>{p.equipo_a}</strong>
                                                        <span style={{ color: '#64748b' }}>vs</span>
                                                        <strong>{p.equipo_b}</strong>
                                                        <span>{renderFlag(p.bandera_b)}</span>
                                                    </td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                                                            backgroundColor: '#334155', color: '#cbd5e1'
                                                        }}>
                                                            {p.fase || 'Fase de Grupos'}
                                                        </span>
                                                    </td>
                                                    <td>{formatMatchDate(p.fecha_partido)}</td>
                                                    <td style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fbbf24', textAlign: 'center' }}>
                                                        {p.goles_a !== null ? `${p.goles_a} - ${p.goles_b}` : '—'}
                                                    </td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                                                            backgroundColor: p.estado === 'finalizado' ? '#065f46' : (p.estado === 'en_curso' ? '#92400e' : '#1e293b'),
                                                            color: p.estado === 'finalizado' ? '#34d399' : (p.estado === 'en_curso' ? '#fbbf24' : '#94a3b8')
                                                        }}>
                                                            {p.estado.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button className="btn btn-sm" style={{ background: '#f59e0b', color: 'white' }} onClick={() => handleEditPartido(p)}>Editar</button>
                                                            <button className="btn btn-sm btn-danger" onClick={() => handleDeletePartido(p.id)}>Borrar</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>
                                {editingPartido ? '📝 Editar Partido' : '➕ Crear Partido'}
                            </h3>
                            <form onSubmit={handleSavePartido} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <label>Equipo A</label>
                                    <input 
                                        type="text" className="filter-input-dark" required placeholder="Argentina"
                                        value={partidoForm.equipo_a} onChange={e => setPartidoForm({...partidoForm, equipo_a: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label>Emoji Bandera A (o link)</label>
                                    <input 
                                        type="text" className="filter-input-dark" placeholder="🇦🇷"
                                        value={partidoForm.bandera_a} onChange={e => setPartidoForm({...partidoForm, bandera_a: e.target.value})}
                                    />
                                </div>
                                <div style={{ borderBottom: '1px dashed #334155', margin: '5px 0' }} />
                                <div>
                                    <label>Equipo B</label>
                                    <input 
                                        type="text" className="filter-input-dark" required placeholder="Francia"
                                        value={partidoForm.equipo_b} onChange={e => setPartidoForm({...partidoForm, equipo_b: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label>Emoji Bandera B</label>
                                    <input 
                                        type="text" className="filter-input-dark" placeholder="🇫🇷"
                                        value={partidoForm.bandera_b} onChange={e => setPartidoForm({...partidoForm, bandera_b: e.target.value})}
                                    />
                                </div>
                                <div style={{ borderBottom: '1px dashed #334155', margin: '5px 0' }} />
                                <div>
                                    <label>Fase / Instancia</label>
                                    <select 
                                        className="filter-input-dark" required
                                        value={partidoForm.fase} onChange={e => setPartidoForm({...partidoForm, fase: e.target.value})}
                                    >
                                        <option value="Fase de Grupos">Fase de Grupos</option>
                                        <option value="Octavos de Final">Octavos de Final</option>
                                        <option value="Cuartos de Final">Cuartos de Final</option>
                                        <option value="Semifinales">Semifinales</option>
                                        <option value="Tercer Puesto">Tercer Puesto</option>
                                        <option value="Final">Final</option>
                                    </select>
                                </div>
                                <div>
                                    <label>Fecha y Hora del Partido</label>
                                    <input 
                                        type="datetime-local" className="filter-input-dark" required
                                        value={partidoForm.fecha_partido} onChange={e => setPartidoForm({...partidoForm, fecha_partido: e.target.value})}
                                    />
                                </div>
                                
                                {editingPartido && (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label>Goles A</label>
                                                <input 
                                                    type="number" className="filter-input-dark" placeholder="Goles"
                                                    value={partidoForm.goles_a} onChange={e => setPartidoForm({...partidoForm, goles_a: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label>Goles B</label>
                                                <input 
                                                    type="number" className="filter-input-dark" placeholder="Goles"
                                                    value={partidoForm.goles_b} onChange={e => setPartidoForm({...partidoForm, goles_b: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label>Estado</label>
                                            <select 
                                                className="filter-input-dark"
                                                value={partidoForm.estado} onChange={e => setPartidoForm({...partidoForm, estado: e.target.value})}
                                            >
                                                <option value="pendiente">Pendiente</option>
                                                <option value="en_curso">En curso</option>
                                                <option value="finalizado">Finalizado</option>
                                            </select>
                                            {partidoForm.estado === 'finalizado' && (
                                                <p style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
                                                    💡 Al finalizar, se distribuirán automáticamente los puntos a los usuarios.
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                        {editingPartido ? 'Guardar' : 'Crear'}
                                    </button>
                                    {editingPartido && (
                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingPartido(null)}>
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* 3. SECCION CALENDARIO */}
                {activeSubTab === 'calendario' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px' }}>
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>Calendario de Premios Diario</h3>
                            <div className="table-responsive">
                                <table className="admin-table-dark">
                                    <thead>
                                        <tr>
                                            <th>Día</th>
                                            <th>Premio</th>
                                            <th>Descripción</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {calendario.map(c => (
                                            <tr key={c.dia} style={{ borderBottom: '1px solid #334155' }}>
                                                <td style={{ padding: '10px', fontWeight: 'bold', color: '#fbbf24' }}>Día {c.dia}</td>
                                                <td>
                                                    <span style={{ 
                                                        padding: '3px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', marginRight: '6px',
                                                        backgroundColor: c.premio_tipo === 'credito_wallet' ? '#1e3a8a' : (c.premio_tipo === 'sobre_figuritas' ? '#581c87' : '#14532d'),
                                                        color: c.premio_tipo === 'credito_wallet' ? '#93c5fd' : (c.premio_tipo === 'sobre_figuritas' ? '#d8b4fe' : '#6ee7b7')
                                                    }}>
                                                        {c.premio_tipo.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                    <strong>
                                                        {c.premio_tipo === 'credito_wallet' ? `$${c.premio_cantidad}` : `${c.premio_cantidad}`}
                                                    </strong>
                                                </td>
                                                <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{c.descripcion}</td>
                                                <td>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => handleEditDia(c)}>Configurar</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', height: 'fit-content' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>
                                {editingDia ? `📅 Configurar Día ${editingDia}` : '👈 Selecciona un Día'}
                            </h3>
                            {editingDia ? (
                                <form onSubmit={handleSaveDia} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label>Tipo de Premio</label>
                                        <select 
                                            className="filter-input-dark"
                                            value={diaForm.premio_tipo}
                                            onChange={e => setDiaForm({...diaForm, premio_tipo: e.target.value})}
                                        >
                                            <option value="puntos">Puntos de Campaña</option>
                                            <option value="credito_wallet">Crédito en Wallet ($)</option>
                                            <option value="sobre_figuritas">Sobre de Figuritas (Paquetes)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Cantidad / Monto</label>
                                        <input 
                                            type="number" className="filter-input-dark" required
                                            value={diaForm.premio_cantidad}
                                            onChange={e => setDiaForm({...diaForm, premio_cantidad: e.target.value})}
                                        />
                                    </div>
                                    
                                    {diaForm.premio_tipo === 'credito_wallet' && (
                                        <div>
                                            <label>Campaña de Crédito Vinculada</label>
                                            <select 
                                                className="filter-input-dark"
                                                value={diaForm.campaign_id}
                                                onChange={e => setDiaForm({...diaForm, campaign_id: e.target.value})}
                                            >
                                                <option value="">-- Sin campaña (Crédito general) --</option>
                                                {walletCampaigns.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} (Expiry: {c.expiry_days} días)</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label>Descripción Visual</label>
                                        <input 
                                            type="text" className="filter-input-dark" required placeholder="¡Reclamá tu sobre hoy!"
                                            value={diaForm.descripcion}
                                            onChange={e => setDiaForm({...diaForm, descripcion: e.target.value})}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar Día</button>
                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingDia(null)}>Cancelar</button>
                                    </div>
                                </form>
                            ) : (
                                <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                                    Haz clic en "Configurar" en cualquier fila del calendario para cambiar el premio diario asignado a los usuarios.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. SECCION MISIONES */}
                {activeSubTab === 'misiones' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
                        <div>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>Misiones Diarias y Minijuegos</h3>
                            <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                <table className="admin-table-dark">
                                    <thead>
                                        <tr>
                                            <th>Título</th>
                                            <th>Premios</th>
                                            <th>Tipo</th>
                                            <th>Fecha</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adminMisiones.length === 0 ? (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No hay misiones configuradas.</td></tr>
                                        ) : (
                                            adminMisiones.map(m => (
                                                <tr key={m.id} style={{ borderBottom: '1px solid #334155' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <strong>{m.titulo}</strong>
                                                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{m.descripcion}</p>
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ fontWeight: 'bold', color: '#10b981' }}>⭐ +{m.puntos_premio} pts</div>
                                                        {m.sobres_premio > 0 && (
                                                            <div style={{ fontWeight: 'bold', color: '#fbbf24', fontSize: '0.75rem', marginTop: '2px' }}>
                                                                ✉️ +{m.sobres_premio} {m.sobres_premio === 1 ? 'sobre' : 'sobres'}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold',
                                                            backgroundColor: '#1e293b', border: '1px solid #475569', color: '#cbd5e1'
                                                        }}>
                                                            {m.tipo.toUpperCase().replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td>{m.fecha}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button className="btn btn-sm btn-secondary" onClick={() => handleEditMision(m)}>Editar</button>
                                                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteMision(m.id)}>Borrar</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', alignSelf: 'start' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>
                                {editingMision ? '📝 Editar Misión' : '➕ Crear Misión'}
                            </h3>
                            <form onSubmit={handleSaveMision} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label>Título de la Misión</label>
                                    <input 
                                        type="text" className="filter-input-dark" required placeholder="Subí una foto con la camiseta"
                                        value={misionForm.titulo} onChange={e => setMisionForm({...misionForm, titulo: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label>Descripción / Instrucciones</label>
                                    <textarea 
                                        className="filter-input-dark" required placeholder="Subí una foto vistiendo la camiseta de la selección y ganá sobres gratis."
                                        style={{ minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                                        value={misionForm.descripcion} onChange={e => setMisionForm({...misionForm, descripcion: e.target.value})}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label>Puntos Premio</label>
                                        <input 
                                            type="number" className="filter-input-dark" required min="0"
                                            value={misionForm.puntos_premio} onChange={e => setMisionForm({...misionForm, puntos_premio: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label>Sobres Premio ✉️</label>
                                        <input 
                                            type="number" className="filter-input-dark" required min="0"
                                            value={misionForm.sobres_premio || 0} onChange={e => setMisionForm({...misionForm, sobres_premio: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label>Fecha de Misión</label>
                                        <input 
                                            type="date" className="filter-input-dark" required
                                            value={misionForm.fecha} onChange={e => setMisionForm({...misionForm, fecha: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label>Tipo / Mecánica de Misión</label>
                                    <select 
                                        className="filter-input-dark" required
                                        value={misionForm.tipo} onChange={e => setMisionForm({...misionForm, tipo: e.target.value})}
                                    >
                                        <option value="imagen_verificacion">📸 Recepción y verificación de foto</option>
                                        <option value="link_verificacion">🔗 Enlace externo con captura/foto</option>
                                        <option value="login_diario">📅 Ingreso diario a la app</option>
                                        <option value="minijuego_penales">⚽ Minijuego: Penales mundialistas</option>
                                        <option value="minijuego_trivia">🧠 Minijuego: Preguntero / Trivia</option>
                                        <option value="pedido">🍔 Realizar un pedido en delivery</option>
                                        <option value="pronostico">🔮 Registrar un pronóstico</option>
                                    </select>
                                </div>

                                {misionForm.tipo === 'link_verificacion' && (
                                    <div>
                                        <label style={{ color: '#fbbf24', fontWeight: 'bold' }}>Enlace de Redirección (URL)</label>
                                        <input 
                                            type="text" className="filter-input-dark" required placeholder="Ej: https://instagram.com/wepi"
                                            value={misionForm.enlace_url || ''} onChange={e => setMisionForm({...misionForm, enlace_url: e.target.value})}
                                        />
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                            Este enlace se mostrará como un botón interactivo al usuario. Deberá adjuntar una captura como comprobante.
                                        </p>
                                    </div>
                                )}
 
                                 {misionForm.tipo === 'imagen_verificacion' && (
                                     <p style={{ fontSize: '0.75rem', color: '#60a5fa', margin: '4px 0 0', lineHeight: '1.4' }}>
                                         💡 <strong>Recepción de fotos:</strong> Esta misión habilitará un selector de archivos en la app para que el cliente adjunte y envíe su foto. Podrás otorgar los puntos manualmente desde el Inyector.
                                     </p>
                                 )}
                                 {misionForm.tipo === 'link_verificacion' && (
                                     <p style={{ fontSize: '0.75rem', color: '#10b981', margin: '4px 0 0', lineHeight: '1.4' }}>
                                         💡 <strong>Acción con Enlace:</strong> Mostrará un botón llamativo para que el usuario visite el enlace (ej: seguirnos en Instagram o compartir post) y suba la captura. Las validaciones se aprueban manualmente desde el Inyector.
                                     </p>
                                 )}
                                 {misionForm.tipo.startsWith('minijuego_') && (
                                    <p style={{ fontSize: '0.75rem', color: '#fbbf24', margin: '4px 0 0', lineHeight: '1.4' }}>
                                        💡 <strong>Minijuego Habilitado:</strong> Activará la mecánica seleccionada (preguntas del preguntero o patear penales) al usuario para que intente conseguir el puntaje.
                                    </p>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar Misión</button>
                                    {editingMision && (
                                        <button type="button" className="btn btn-secondary" onClick={() => {
                                            setEditingMision(null);
                                            setMisionForm({
                                                titulo: '', descripcion: '', puntos_premio: 50, sobres_premio: 0, tipo: 'imagen_verificacion', fecha: new Date().toISOString().substring(0, 10), enlace_url: ''
                                            });
                                        }}>Cancelar</button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* 6. SECCION CUPONES */}
                {activeSubTab === 'cupones' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
                        <div>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>Configuración de Cupones / Códigos de Canje</h3>
                            <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                <table className="admin-table-dark">
                                    <thead>
                                        <tr>
                                            <th>Código</th>
                                            <th>Premio</th>
                                            <th>Límite Usos</th>
                                            <th>Canjeados</th>
                                            <th>Estado</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cupones.length === 0 ? (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No hay cupones creados.</td></tr>
                                        ) : (
                                            cupones.map(cup => (
                                                <tr key={cup.codigo} style={{ borderBottom: '1px solid #334155' }}>
                                                    <td style={{ padding: '12px', fontWeight: '900', color: '#fbbf24' }}>{cup.codigo}</td>
                                                    <td>
                                                        {cup.premio_tipo === 'figurita_especifica' ? (
                                                            <span style={{ fontSize: '0.8rem', color: '#60a5fa' }}>🖼️ Figu #{cup.figurita_numero}</span>
                                                        ) : (
                                                            <span style={{ fontSize: '0.8rem', color: cup.premio_tipo === 'sobre_figuritas' ? '#10b981' : '#f59e0b' }}>
                                                                {cup.premio_tipo === 'sobre_figuritas' ? `✉️ x${cup.premio_cantidad} sobres` : `⭐ +${cup.premio_cantidad} pts`}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{cup.limite_usos}</td>
                                                    <td style={{ fontWeight: 'bold' }}>{cup.usos_actuales}</td>
                                                    <td>
                                                        <span style={{ 
                                                            padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold',
                                                            backgroundColor: cup.activo ? '#065f46' : '#7f1d1d',
                                                            color: cup.activo ? '#34d399' : '#f87171'
                                                        }}>
                                                            {cup.activo ? 'ACTIVO' : 'INACTIVO'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button className="btn btn-sm btn-secondary" onClick={() => handleEditCupon(cup)}>Editar</button>
                                                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCupon(cup.codigo)}>Borrar</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', alignSelf: 'start' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>
                                {editingCupon ? '📝 Editar Cupón' : '➕ Crear Cupón'}
                            </h3>
                            <form onSubmit={handleSaveCupon} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label>Código de Canje (Sin espacios)</label>
                                    <input 
                                        type="text" className="filter-input-dark" required placeholder="EJ: SCALONETA"
                                        style={{ textTransform: 'uppercase' }}
                                        value={cuponForm.codigo} onChange={e => setCuponForm({...cuponForm, codigo: e.target.value})}
                                        disabled={editingCupon}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div>
                                        <label>Límite de Usos</label>
                                        <input 
                                            type="number" className="filter-input-dark" required
                                            value={cuponForm.limite_usos} onChange={e => setCuponForm({...cuponForm, limite_usos: e.target.value})}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '18px', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={cuponForm.activo} 
                                                onChange={e => setCuponForm({...cuponForm, activo: e.target.checked})}
                                            />
                                            Código Activo
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label>Tipo de Recompensa</label>
                                    <select 
                                        className="filter-input-dark" required
                                        value={cuponForm.premio_tipo} onChange={e => setCuponForm({...cuponForm, premio_tipo: e.target.value})}
                                    >
                                        <option value="puntos">⭐ Puntos de Campaña</option>
                                        <option value="sobre_figuritas">✉️ Paquetes de figuritas cerrados</option>
                                        <option value="figurita_especifica">🖼️ Una figurita específica</option>
                                    </select>
                                </div>

                                {cuponForm.premio_tipo === 'figurita_especifica' ? (
                                    <div>
                                        <label>Número de Figurita del Catálogo (1 al 39)</label>
                                        <input 
                                            type="number" className="filter-input-dark" required placeholder="Ej: 10" min="1" max="39"
                                            value={cuponForm.figurita_numero} onChange={e => setCuponForm({...cuponForm, figurita_numero: e.target.value})}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label>Cantidad (Puntos o Sobres)</label>
                                        <input 
                                            type="number" className="filter-input-dark" required
                                            value={cuponForm.premio_cantidad} onChange={e => setCuponForm({...cuponForm, premio_cantidad: e.target.value})}
                                        />
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar Cupón</button>
                                    {editingCupon && (
                                        <button type="button" className="btn btn-secondary" onClick={() => {
                                            setEditingCupon(null);
                                            setCuponForm({
                                                codigo: '', premio_tipo: 'puntos', premio_cantidad: 100, figurita_numero: '', limite_usos: 100, activo: true
                                            });
                                        }}>Cancelar</button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* 7. SECCION USUARIOS E INYECTOR MANUAL */}
                {activeSubTab === 'usuarios' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
                        <div>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>👤 Selector de Usuario</h3>
                            <div style={{ marginBottom: '15px' }}>
                                <input 
                                    type="text" 
                                    className="filter-input-dark" 
                                    placeholder="🔍 Buscar por nombre o email..." 
                                    value={searchUserQuery}
                                    onChange={e => setSearchUserQuery(e.target.value)}
                                    style={{ width: '100%', padding: '12px' }}
                                />
                            </div>
                            
                            <div className="table-responsive" style={{ maxHeight: '480px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '8px' }}>
                                <table className="admin-table-dark">
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th>Email</th>
                                            <th>Selección</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usersList
                                            .filter(u => 
                                                u.nombre.toLowerCase().includes(searchUserQuery.toLowerCase()) || 
                                                u.email.toLowerCase().includes(searchUserQuery.toLowerCase())
                                            )
                                            .slice(0, 50) 
                                            .map(u => {
                                                const isSel = selectedUser?.id === u.id;
                                                return (
                                                    <tr 
                                                        key={u.id} 
                                                        style={{ 
                                                            borderBottom: '1px solid #334155',
                                                            backgroundColor: isSel ? 'rgba(251, 191, 36, 0.08)' : 'transparent'
                                                        }}
                                                    >
                                                        <td style={{ padding: '10px' }}><strong>{u.nombre}</strong></td>
                                                        <td>{u.email}</td>
                                                        <td style={{ textAlign: 'right', paddingRight: '15px' }}>
                                                            <button 
                                                                className={`btn btn-sm ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                                                                onClick={() => setSelectedUser(u)}
                                                            >
                                                                {isSel ? '✅ Seleccionado' : 'Seleccionar'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', alignSelf: 'start' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>⚡ Inyector de Premios Manual</h3>
                            {selectedUser ? (
                                <form onSubmit={handleInjectRewards} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div style={{ padding: '10px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                        Otorgar premio manual a:
                                        <br />
                                        <strong>👤 {selectedUser.nombre}</strong>
                                        <br />
                                        <span style={{ color: '#94a3b8' }}>✉️ {selectedUser.email}</span>
                                    </div>
                                    
                                    <div>
                                        <label>Tipo de Recompensa</label>
                                        <select 
                                            className="filter-input-dark" required
                                            value={injectForm.premio_tipo} onChange={e => setInjectForm({...injectForm, premio_tipo: e.target.value})}
                                        >
                                            <option value="puntos">⭐ Inyectar Puntos de Campaña</option>
                                            <option value="sobre_figuritas">✉️ Agregar Sobres de Figuritas</option>
                                            <option value="figurita_especifica">🖼️ Agregar Figurita Específica (Catálogo)</option>
                                        </select>
                                    </div>

                                    {injectForm.premio_tipo === 'figurita_especifica' ? (
                                        <div>
                                            <label>Número de Figurita (1 al 39)</label>
                                            <input 
                                                type="number" className="filter-input-dark" required placeholder="Ej: 10" min="1" max="39"
                                                value={injectForm.figurita_numero} onChange={e => setInjectForm({...injectForm, figurita_numero: e.target.value})}
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <label>Cantidad a Otorgar</label>
                                            <input 
                                                type="number" className="filter-input-dark" required min="1"
                                                value={injectForm.premio_cantidad} onChange={e => setInjectForm({...injectForm, premio_cantidad: e.target.value})}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label>Motivo / Verificación de Promo (Opcional)</label>
                                        <input 
                                            type="text" className="filter-input-dark" placeholder="Ej: Foto de camiseta verificada correctamente"
                                            value={injectForm.motivo} onChange={e => setInjectForm({...injectForm, motivo: e.target.value})}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px' }}>
                                            🚀 Otorgar Premio Manual
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={() => setSelectedUser(null)}>
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0', border: '2px dashed #334155', borderRadius: '12px' }}>
                                    👈 Primero buscá y seleccioná un usuario de la lista de la izquierda para habilitar la inyección manual de premios.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. SECCION FIGURITAS */}
                {activeSubTab === 'figuritas' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
                        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>Listado de 39 Figuritas</h3>
                            <div className="table-responsive">
                                <table className="admin-table-dark">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Miniatura</th>
                                            <th>Nombre</th>
                                            <th>Categoría</th>
                                            <th>Rareza</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {figuritas.map(f => (
                                            <tr key={f.id} style={{ borderBottom: '1px solid #334155' }}>
                                                <td style={{ fontWeight: 'bold', color: '#fbbf24', padding: '10px' }}>#{f.numero}</td>
                                                <td>
                                                    {f.foto_url ? (
                                                        <img src={f.foto_url} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #334155' }} />
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sin imagen</span>
                                                    )}
                                                </td>
                                                <td><strong>{f.nombre}</strong></td>
                                                <td>
                                                    <span style={{ fontSize: '0.8rem', color: f.categoria === 'Argentina' ? '#38bdf8' : '#fb7185' }}>{f.categoria}</span>
                                                </td>
                                                <td>
                                                    <span style={{ 
                                                        fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                                                        backgroundColor: f.rareza === 'legendaria' ? '#78350f' : (f.rareza === 'dificil' ? '#1e3a8a' : '#1e293b'),
                                                        color: f.rareza === 'legendaria' ? '#fbbf24' : (f.rareza === 'dificil' ? '#60a5fa' : '#94a3b8')
                                                    }}>
                                                        {f.rareza.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => handleEditFigurita(f)}>Cargar Enlace</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', height: 'fit-content' }}>
                            <h3 style={{ color: '#fbbf24', marginTop: 0 }}>
                                {editingFigurita ? `🖼️ Editar Figu #${editingFigurita.numero}` : '👈 Selecciona una Figurita'}
                            </h3>
                            {editingFigurita ? (
                                <form onSubmit={handleSaveFigurita} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label>Nombre del Jugador / Elemento</label>
                                        <input 
                                            type="text" className="filter-input-dark" required
                                            value={figuritaForm.nombre}
                                            onChange={e => setFiguritaForm({...figuritaForm, nombre: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label>Categoría</label>
                                        <select 
                                            className="filter-input-dark"
                                            value={figuritaForm.categoria}
                                            onChange={e => setFiguritaForm({...figuritaForm, categoria: e.target.value})}
                                        >
                                            <option value="Argentina">Selección Argentina</option>
                                            <option value="Especiales">Especiales (Escudos/Mascotas)</option>
                                            <option value="Estrellas Globales">Estrellas Globales</option>
                                            <option value="Leyendas">Leyendas del Deporte</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Rareza</label>
                                        <select 
                                            className="filter-input-dark"
                                            value={figuritaForm.rareza}
                                            onChange={e => setFiguritaForm({...figuritaForm, rareza: e.target.value})}
                                        >
                                            <option value="comun">Común (75%)</option>
                                            <option value="dificil">Difícil (20%)</option>
                                            <option value="legendaria">Legendaria (5%)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Enlace Web de la Imagen (URL)</label>
                                        <input 
                                            type="url" className="filter-input-dark" placeholder="https://ejemplo.com/messi.png"
                                            value={figuritaForm.foto_url}
                                            onChange={e => setFiguritaForm({...figuritaForm, foto_url: e.target.value})}
                                        />
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                                            Pega aquí el enlace de la imagen que creaste manualmente. Se renderizará al instante en el álbum.
                                        </p>
                                    </div>

                                    {figuritaForm.foto_url && (
                                        <div style={{ textAlign: 'center', background: '#1e293b', padding: '10px', borderRadius: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '5px' }}>Vista Previa</span>
                                            <img src={figuritaForm.foto_url} alt="Preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #fbbf24' }} onError={(e) => { e.target.style.display = 'none'; }} />
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar Datos</button>
                                        <button type="button" className="btn btn-secondary" onClick={() => setEditingFigurita(null)}>Cancelar</button>
                                    </div>
                                </form>
                            ) : (
                                <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
                                    Haz clic en "Cargar Enlace" en cualquier figurita de la lista para asignar o cambiar su nombre, rareza y la imagen que creaste manualmente.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Custom admin styles for Mundial panel */}
            <style dangerouslySetInnerHTML={{ __html: `
                .filter-input-dark {
                    width: 100%;
                    padding: 8px 12px;
                    background-color: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 6px;
                    color: #f8fafc;
                    font-size: 0.875rem;
                    box-sizing: border-box;
                    margin-top: 4px;
                }
                .filter-input-dark:focus {
                    outline: none;
                    border-color: #fbbf24;
                    box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2);
                }
                .admin-table-dark {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.9rem;
                }
                .admin-table-dark th {
                    background-color: #0f172a;
                    padding: 10px;
                    color: #94a3b8;
                    font-weight: 600;
                    border-bottom: 2px solid #334155;
                }
                .admin-table-dark td {
                    padding: 10px;
                    border-bottom: 1px solid #1e293b;
                }
                .admin-table-dark tr:hover {
                    background-color: #334155;
                }
                .sub-tabs-mundial .btn {
                    padding: 6px 14px;
                    font-size: 0.8rem;
                }
            `}} />
        </div>
    );
};

export default AdminMundial;
