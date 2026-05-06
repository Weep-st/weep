import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import toast from 'react-hot-toast';

const AdminReportes = () => {
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [locales, setLocales] = useState([]);
    const [localId, setLocalId] = useState('Todos');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('generar'); // 'generar', 'historial_locales', 'historial_repartidores', 'stats'
    const [historial, setHistorial] = useState([]);
    const [statsDates, setStatsDates] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [statsData, setStatsData] = useState(null);
    const [deudasLocales, setDeudasLocales] = useState({});
    const [deudasLoading, setDeudasLoading] = useState(false);
    const [selectedCierre, setSelectedCierre] = useState(null);
    const [deleteParams, setDeleteParams] = useState({
        status: 'Rechazado',
        start: '',
        end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Por defecto hasta hace una semana
    });
    const [cierreMode, setCierreMode] = useState('dia');
    const [cierreFechaInicio, setCierreFechaInicio] = useState(new Date().toISOString().split('T')[0]);
    const [cierreFechaFin, setCierreFechaFin] = useState(new Date().toISOString().split('T')[0]);



    useEffect(() => {
        const loadLocales = async () => {
            try {
                const data = await api.adminGetLocales();
                setLocales(data.filter(l => l.admin_status === 'Aceptado'));
            } catch (err) {
                console.error(err);
            }
        };
        loadLocales();
    }, []);

    useEffect(() => {
        if (activeTab === 'historial_locales') loadHistorialLocales();
        if (activeTab === 'historial_repartidores') loadHistorialRepartidores();
        if (activeTab === 'deudas') loadDeudasLocales();
    }, [activeTab, localId]);

    const loadHistorialLocales = async () => {
        setLoading(true);
        try {
            const data = await api.getHistorialCierresLocales(localId);
            setHistorial(data);
        } catch (err) {
            toast.error('Error al cargar historial');
        } finally {
            setLoading(false);
        }
    };

    const loadHistorialRepartidores = async () => {
        setLoading(true);
        try {
            const data = await api.getHistorialCierresRepartidores();
            setHistorial(data);
        } catch (err) {
            toast.error('Error al cargar historial');
        } finally {
            setLoading(false);
        }
    };
    const loadDeudasLocales = async () => {
        setDeudasLoading(true);
        try {
            const data = await api.adminGetLocalesDebt();
            setDeudasLocales(data);
        } catch (err) {
            toast.error('Error al cargar deudas');
        } finally {
            setDeudasLoading(false);
        }
    };

    const loadGlobalStats = async () => {
        setLoading(true);
        try {
            const data = await api.getAdminAnalytics(statsDates.start, statsDates.end);
            setStatsData(data);
        } catch (err) {
            toast.error('Error al cargar estadísticas');
        } finally {
            setLoading(false);
        }
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            if (localId === 'Todos') {
                const res = await api.getAdminCierreReport(fecha, localId);
                if (res.success) {
                    setReportData(res);
                }
            } else {
                let options = {};
                if (cierreMode === 'dia') options = { fecha: fecha };
                else if (cierreMode === 'intervalo') options = { inicio: cierreFechaInicio, fin: cierreFechaFin };
                else options = { pendientes: true };

                const res = await api.getLocalCierreReport(localId, options);
                if (res.success) {
                    setReportData({ ...res, isLocalReport: true, localId: localId });
                }
            }
        } catch (err) {
            toast.error('Error al cargar reporte: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaldarRepartidores = async () => {
        if (!reportData || reportData.repartidores.length === 0) return;
        if (!window.confirm('¿Deseas guardar el registro de liquidación para estos repartidores?')) return;

        try {
            setLoading(true);
            const totalSaldado = reportData.repartidores.reduce((acc, r) => acc + r.monto_envio, 0);
            await api.saveRepartidorCierre({
                fecha,
                totalSaldado,
                totalAdeudado: 0,
                numPedidos: reportData.pedidos.length,
                detalles: reportData.repartidores,
                pedidos: reportData.pedidos
            });
            toast.success('Liquidación registrada con éxito');
            setReportData(null); // Reset to force reload and clear closed orders
        } catch (err) {
            toast.error('Error al guardar liquidación');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLocalCierre = async () => {
        if (!reportData || !reportData.isLocalReport) return;
        const local = locales.find(l => l.id === reportData.localId);
        if (!window.confirm(`¿Deseas efectuar el cierre de caja para "${local?.nombre || 'este local'}"? Los pedidos incluidos quedarán marcados como cerrados.`)) return;

        try {
            setLoading(true);
            await api.saveLocalCierre({
                localId: reportData.localId,
                fecha: reportData.fecha,
                subtotal: reportData.subtotal,
                comisiones: reportData.comisiones,
                comisionEfectivo: reportData.comisionEfectivo,
                neto: reportData.neto,
                transferencia: reportData.transferencia,
                efectivo: reportData.efectivo,
                pedidos: reportData.pedidos
            });
            toast.success('Cierre de caja efectuado con éxito');
            setReportData(null);
        } catch (err) {
            toast.error('Error al guardar el cierre: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCierre = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este cierre? Los pedidos asociados se reabrirán y volverán a estar pendientes de cierre.')) return;
        
        try {
            setLoading(true);
            await api.adminDeleteCierreLocal(id);
            toast.success('Cierre eliminado con éxito');
            loadHistorialLocales();
        } catch (err) {
            toast.error('Error al eliminar cierre: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForceDelete = async () => {
        const msg = deleteParams.status === 'Entregado' 
            ? '⚠️ ATENCIÓN: Se eliminarán los pedidos ENTREGADOS que ya fueron CERRADOS y PAGADOS.' 
            : `⚠️ ATENCIÓN: Se eliminarán permanentemente los pedidos en estado "${deleteParams.status}" del periodo seleccionado.`;
            
        if (!window.confirm(`${msg}\n\n¿Estás seguro? Esta acción no se puede deshacer.`)) return;
        
        try {
            setLoading(true);
            const res = await api.adminForceDeleteOrders({
                status: deleteParams.status,
                startDate: deleteParams.start,
                endDate: deleteParams.end
            });
            toast.success(`Se eliminaron ${res.count} pedidos con éxito.`);
        } catch (err) {
            toast.error('Error al eliminar pedidos');
        } finally {
            setLoading(false);
        }
    };



    return (
        <div className="panel-card animate-fade-in">
            <header className="panel-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div className="header-info">
                        <h2>📊 Informes de Gestión</h2>
                        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Consolidado de ventas y repartidores</p>
                    </div>
                    <div className="rd-tabs" style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
                        <button 
                            className={`btn btn-sm ${activeTab === 'generar' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setActiveTab('generar')}
                            style={{ fontSize: '0.75rem' }}
                        >
                            Generar Nuevo
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'historial_locales' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setActiveTab('historial_locales')}
                            style={{ fontSize: '0.75rem' }}
                        >
                            Cierres Locales
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'historial_repartidores' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setActiveTab('historial_repartidores')}
                            style={{ fontSize: '0.75rem' }}
                        >
                            Liquidaciones Repartidores
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'stats' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => { setActiveTab('stats'); loadGlobalStats(); }}
                            style={{ fontSize: '0.75rem' }}
                        >
                            📊 Estadísticas Globales
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'deudas' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setActiveTab('deudas')}
                            style={{ fontSize: '0.75rem' }}
                        >
                            💸 Deudas Locales
                        </button>
                        <button 
                            className={`btn btn-sm ${activeTab === 'maintenance' ? 'btn-primary' : 'btn-ghost'}`} 
                            onClick={() => setActiveTab('maintenance')}
                            style={{ fontSize: '0.75rem', color: activeTab === 'maintenance' ? 'white' : 'var(--red-600)' }}
                        >
                            🗑️ Limpieza
                        </button>

                    </div>

                </div>

                {activeTab === 'generar' && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                        <select 
                            className="form-select" 
                            style={{ marginBottom: 0, width: '200px' }}
                            value={localId}
                            onChange={(e) => {
                                setLocalId(e.target.value);
                                setReportData(null);
                            }}
                        >
                            <option value="Todos">Todos los locales (Repartidores)</option>
                            {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                        </select>

                        {localId !== 'Todos' && (
                            <select 
                                className="form-select" 
                                style={{ marginBottom: 0, width: '150px' }}
                                value={cierreMode}
                                onChange={(e) => setCierreMode(e.target.value)}
                            >
                                <option value="dia">Día específico</option>
                                <option value="intervalo">Intervalo de fechas</option>
                                <option value="pendientes">Todo lo pendiente</option>
                            </select>
                        )}

                        {cierreMode === 'dia' || localId === 'Todos' ? (
                            <input 
                                type="date" 
                                className="form-input" 
                                style={{ marginBottom: 0, width: 'auto' }}
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                            />
                        ) : cierreMode === 'intervalo' ? (
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                <input type="date" className="form-input" style={{ marginBottom: 0 }} value={cierreFechaInicio} onChange={e => setCierreFechaInicio(e.target.value)} />
                                <span>a</span>
                                <input type="date" className="form-input" style={{ marginBottom: 0 }} value={cierreFechaFin} onChange={e => setCierreFechaFin(e.target.value)} />
                            </div>
                        ) : null}

                        <button className="btn btn-primary" onClick={loadReport} disabled={loading}>
                            {loading ? 'Cargando...' : 'Ver Informe'}
                        </button>
                    </div>
                )}
                
                {(activeTab === 'historial_locales') && (
                    <div style={{ width: '100%' }}>
                         <select 
                            className="form-select" 
                            style={{ marginBottom: 0, width: '200px' }}
                            value={localId}
                            onChange={(e) => setLocalId(e.target.value)}
                        >
                            <option value="Todos">Filtrar por local...</option>
                            {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                        </select>
                    </div>
                )}
            </header>

            {activeTab === 'generar' ? (
                !reportData ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
                        Selecciona los filtros y haz clic en "Ver Informe"
                    </div>
                ) : reportData.isLocalReport ? (
                    <div className="report-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', padding: '15px', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--gray-800)' }}>🏪 Cierre de Caja: {locales.find(l => l.id === reportData.localId)?.nombre}</h3>
                                <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    {cierreMode === 'pendientes' ? 'Pedidos pendientes de cierre' : `Periodo: ${reportData.fecha}`}
                                </p>
                            </div>
                            <button className="btn btn-success" onClick={handleSaveLocalCierre} disabled={loading || reportData.pedidos.length === 0}>
                                ✅ Efectuar Cierre de Caja
                            </button>
                        </div>

                        <div className="table-responsive">
                             <table className="admin-table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                    <tr>
                                        <th>Pedido</th>
                                        <th>Fecha/Hora</th>
                                        <th>Método</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                        <th style={{ textAlign: 'right', color: 'var(--red-600)' }}>Com. (%)</th>
                                        <th style={{ textAlign: 'right', color: 'var(--red-600)' }}>Monto Com.</th>
                                        <th style={{ textAlign: 'right', fontWeight: 700 }}>Neto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.pedidos.map(p => (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 600 }}>#{p.id.slice(0, 8)}</td>
                                            <td style={{ fontSize: '0.75rem' }}>
                                                {new Date(new Date(p.hora).getTime() + 3 * 60 * 60 * 1000).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </td>
                                            <td>{p.metodo}</td>
                                            <td style={{ textAlign: 'right' }}>${p.total}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--red-600)' }}>{p.comision_pct}%</td>
                                            <td style={{ textAlign: 'right', color: 'var(--red-600)' }}>-${p.comision_monto}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>${(Number(p.total) - Number(p.comision_monto)).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {reportData.pedidos.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-400)' }}>Sin pedidos para este periodo.</td>
                                        </tr>
                                    ) : (
                                        <>
                                            <tr style={{ borderTop: '2px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                                                <td colSpan="3" style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'right' }}>TOTAL VENTA (BRUTO)</td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700 }}>${reportData.subtotal}</td>
                                                <td colSpan="3"></td>
                                            </tr>
                                            <tr style={{ background: 'var(--gray-50)' }}>
                                                <td colSpan="3" style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'right', color: 'var(--red-600)' }}>COMISIÓN WEPI</td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--red-600)' }}>-${reportData.comisiones}</td>
                                                <td colSpan="3" style={{ fontSize: '0.75rem', color: 'var(--gray-500)', verticalAlign: 'middle', paddingLeft: '15px' }}>
                                                    <div style={{ display: 'flex', gap: '15px' }}>
                                                        <span>Saldada (Transf.): -${(Number(reportData.comisiones) - Number(reportData.comisionEfectivo)).toFixed(2)}</span>
                                                        <span style={{ color: 'var(--red-600)', fontWeight: 600 }}>Pendiente (Efectivo): -${reportData.comisionEfectivo}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr style={{ background: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                                                <td colSpan="3" style={{ padding: '12px 16px', fontWeight: 800, textAlign: 'right', color: '#166534', fontSize: '1rem' }}>TOTAL NETO (sin comisión Wepi)</td>
                                                <td colSpan="2"></td>
                                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: '#166534', fontSize: '1rem' }}>${reportData.neto}</td>
                                                <td></td>
                                            </tr>
                                            <tr style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                                <td colSpan="7" style={{ padding: '16px 8px', textAlign: 'right' }}>
                                                    <div style={{ marginBottom: 4 }}>
                                                        <span style={{ marginRight: 20 }}>💳 Transferencia: ${reportData.transferencia}</span>
                                                        <span>💵 Efectivo: ${reportData.efectivo}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                             </table>
                        </div>
                    </div>
                ) : (
                    <div className="report-content" style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: '20px' }}>
                        
                        {/* Sección Repartidores */}
                        <div className="report-section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0 }}>🛵 Liquidación de Repartidores</h3>
                                <button className="btn btn-success btn-sm" onClick={handleSaldarRepartidores} disabled={loading || reportData.repartidores.length === 0}>
                                    ✅ Marcar como Saldados (Guardar)
                                </button>
                            </div>
                            
                            <div className="table-responsive">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Repartidor</th>
                                            <th>Pedidos Entregados</th>
                                            <th>Monto a Pagar</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.repartidores.map(r => (
                                            <tr key={r.id}>
                                                <td style={{ fontWeight: 600 }}>{r.nombre}</td>
                                                <td>{r.entregados} pedidos</td>
                                                <td style={{ color: 'var(--blue-600)', fontWeight: 700 }}>${r.monto_envio.toFixed(2)}</td>
                                                <td>
                                                    <button className="btn btn-ghost btn-xs" style={{ color: 'var(--blue-600)' }}>Ver Detalle</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {reportData.repartidores.length === 0 && (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No hay envíos registrados para esta fecha.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Resumen de Ventas por Local */}
                        <div className="report-section">
                            <h3 style={{ marginBottom: '15px' }}>🏪 Resumen de Ventas</h3>
                            <div className="table-responsive">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>ID Pedido</th>
                                            <th>Cliente</th>
                                            <th>Método</th>
                                            <th>Subtotal</th>
                                            <th style={{ color: 'var(--red-600)' }}>Comisión Wepi</th>
                                            <th>Envío</th>
                                            <th>Total Final</th>
                                        </tr>

                                    </thead>
                                    <tbody>
                                        {reportData.pedidos.map(p => (
                                            <tr key={p.id}>
                                                <td style={{ fontSize: '0.8rem' }}>#{p.num_confirmacion || p.id.slice(0,8)}</td>
                                                <td>{p.nombre_cliente}</td>
                                                <td>{p.metodo_pago}</td>
                                                <td>${(Number(p.total) - Number(p.precio_envio)).toFixed(2)}</td>
                                                <td style={{ color: 'var(--red-600)', fontWeight: 600 }}>-${Number(p.total_comision || 0).toFixed(2)}</td>
                                                <td>${Number(p.precio_envio).toFixed(2)}</td>
                                                <td style={{ fontWeight: 700 }}>${Number(p.total).toFixed(2)}</td>
                                            </tr>

                                        ))}
                                        {reportData.pedidos.length === 0 && (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No hay pedidos registrados para esta fecha.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            ) : activeTab === 'historial_locales' ? (
                <div className="report-content" style={{ padding: '20px' }}>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Fecha</th>
                                    <th>Local</th>
                                    <th>Subtotal</th>
                                    <th>Comisión</th>
                                    <th>Neto</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>{c.id.slice(0,8)}</td>
                                        <td>{new Date(c.fecha).toLocaleDateString('es-AR')}</td>
                                        <td style={{ fontWeight: 600 }}>{c.locales?.nombre}</td>
                                        <td>${c.total_subtotal}</td>
                                        <td style={{ color: 'var(--red-600)' }}>-${c.total_comisiones}</td>
                                        <td style={{ fontWeight: 700, color: '#166534' }}>${c.total_neto_local}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button className="btn btn-ghost btn-xs" onClick={() => {
                                                    setSelectedCierre(c);
                                                }}>Ver Detalle</button>
                                                <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red-600)' }} onClick={() => handleDeleteCierre(c.id)}>
                                                    Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {historial.length === 0 && (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>No hay cierres registrados.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'stats' ? (
                <div className="report-content" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Desde:</span>
                            <input type="date" className="form-input" style={{ marginBottom: 0, width: '150px' }} value={statsDates.start} onChange={e => setStatsDates(s => ({...s, start: e.target.value}))} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Hasta:</span>
                            <input type="date" className="form-input" style={{ marginBottom: 0, width: '150px' }} value={statsDates.end} onChange={e => setStatsDates(s => ({...s, end: e.target.value}))} />
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={loadGlobalStats}>Filtrar</button>
                    </div>

                    {statsData && (
                        <div className="animate-fade-in">
                            <div className="report-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 25 }}>
                                <div className="stat-card" style={{ padding: 15, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>PEDIDOS TOTALES</span>
                                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{statsData.totals.totalPedidos}</p>
                                </div>
                                <div className="stat-card" style={{ padding: 15, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>VENTAS BRUTAS (S/T)</span>
                                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#166534' }}>${statsData.totals.totalVentas.toLocaleString()}</p>
                                </div>
                                <div className="stat-card" style={{ padding: 15, background: '#fff5f5', borderRadius: 10, border: '1px solid #feb2b2' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--red-600)', fontWeight: 600 }}>COMISIONES WEPI</span>
                                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--red-600)' }}>${statsData.totals.totalComisiones.toLocaleString()}</p>
                                </div>
                                <div className="stat-card" style={{ padding: 15, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>NETO PARA LOCALES</span>
                                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#1e40af' }}>${statsData.totals.totalNetoLocales.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="table-responsive">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Local</th>
                                            <th>Pedidos</th>
                                            <th>Venta</th>
                                            <th>Comisión</th>
                                            <th>Neto Local</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {statsData.rawData.map(h => (
                                            <tr key={h.id}>
                                                <td>{new Date(h.fecha).toLocaleDateString('es-AR')}</td>
                                                <td style={{ fontWeight: 600 }}>{h.locales?.nombre}</td>
                                                <td>{h.num_pedidos}</td>
                                                <td>${h.total_subtotal}</td>
                                                <td style={{ color: 'var(--red-600)' }}>${h.total_comisiones}</td>
                                                <td style={{ fontWeight: 700 }}>${h.total_neto_local}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : activeTab === 'maintenance' ? (
                <div className="report-content" style={{ padding: '20px' }}>
                    <div className="card card-body" style={{ maxWidth: '600px', margin: '0 auto', border: '1px solid var(--red-200)', background: '#fff5f5' }}>
                        <h3 style={{ color: 'var(--red-600)', marginBottom: '15px' }}>🗑️ Mantenimiento de Base de Datos</h3>
                        <p style={{ fontSize: '0.9rem', color: '#7f1d1d', marginBottom: '25px' }}>
                            Utiliza esta herramienta para eliminar pedidos antiguos o fallidos y liberar espacio. 
                            <strong> Nota:</strong> Los pedidos "Entregados" solo se eliminarán si ya han sido liquidados.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Estado de los pedidos a eliminar:</label>
                                <select 
                                    className="form-select" 
                                    value={deleteParams.status}
                                    onChange={(e) => setDeleteParams({...deleteParams, status: e.target.value})}
                                >
                                    <option value="Rechazado">❌ Rechazados</option>
                                    <option value="Cancelado">🚫 Cancelados</option>
                                    <option value="Pendiente">⏳ Pendientes (Huérfanos)</option>
                                    <option value="Entregado">✅ Entregados (Cerrados y Pagados)</option>
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Desde:</label>
                                    <input 
                                        type="date" 
                                        className="form-input" 
                                        value={deleteParams.start}
                                        onChange={(e) => setDeleteParams({...deleteParams, start: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Hasta (inclusive):</label>
                                    <input 
                                        type="date" 
                                        className="form-input" 
                                        value={deleteParams.end}
                                        onChange={(e) => setDeleteParams({...deleteParams, end: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '20px', padding: '15px', background: 'white', borderRadius: '8px', border: '1px solid var(--red-100)', fontSize: '0.85rem' }}>
                                <p style={{ margin: 0, color: 'var(--red-600)' }}>
                                    ⚠️ <strong>IMPORTANTE:</strong> Se eliminarán registros de <code>pedidos_general</code>, <code>pedidos_locales</code> y <code>pedidos_items</code> que coincidan con los filtros.
                                </p>
                            </div>

                            <button 
                                className="btn btn-danger btn-full" 
                                style={{ background: 'var(--red-600)', marginTop: '10px' }}
                                onClick={handleForceDelete}
                                disabled={loading}
                            >
                                {loading ? 'Procesando...' : `Eliminar Pedidos "${deleteParams.status}"`}
                            </button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'deudas' ? (
                <div className="report-content" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0 }}>💸 Deudas de Locales (Comisión Efectivo Pendiente)</h3>
                        <button className="btn btn-primary btn-sm" onClick={loadDeudasLocales} disabled={deudasLoading}>
                            {deudasLoading ? 'Actualizando...' : 'Refrescar Deudas'}
                        </button>
                    </div>

                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Local</th>
                                    <th style={{ textAlign: 'right' }}>Comisión Pendiente (Efectivo)</th>
                                    <th>Acción Sugerida</th>
                                </tr>
                            </thead>
                            <tbody>
                                {locales.map(l => {
                                    const deuda = deudasLocales[l.id] || 0;
                                    return (
                                        <tr key={l.id}>
                                            <td style={{ fontWeight: 600 }}>{l.nombre}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: deuda > 0 ? 'var(--red-600)' : 'var(--green-600)' }}>
                                                ${deuda.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td>
                                                {deuda > 0 ? (
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        A la espera de pago por transferencia del local.
                                                    </span>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>Al día</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {locales.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>No hay locales activos.</td>
                                    </tr>
                                ) : (
                                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                        <td style={{ fontWeight: 800 }}>TOTAL DEUDA PENDIENTE</td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--red-600)', fontSize: '1.1rem' }}>
                                            ${Object.values(deudasLocales).reduce((acc, d) => acc + (Number(d) || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (

                <div className="report-content" style={{ padding: '20px' }}>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Fecha</th>
                                    <th>Cant. Pedidos</th>
                                    <th>Total Saldado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map(l => (
                                    <tr key={l.id}>
                                        <td style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>{l.id.slice(0,8)}</td>
                                        <td>{new Date(l.fecha_cierre).toLocaleDateString('es-AR')}</td>
                                        <td>{l.num_pedidos} envíos</td>
                                        <td style={{ fontWeight: 700, color: 'var(--blue-600)' }}>${l.total_saldado}</td>
                                        <td>
                                            <button className="btn btn-ghost btn-xs" onClick={() => {
                                                console.log(l.detalles_por_repartidor);
                                                toast(`ID Liquidación: ${l.id}\nDatos enviados a consola.`);
                                            }}>Ver Repartidores</button>
                                        </td>
                                    </tr>
                                ))}
                                {historial.length === 0 && (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No hay liquidaciones registradas.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedCierre && (
                <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }} onClick={() => setSelectedCierre(null)}>
                    <div className="modal-content animate-slide-up" style={{ background: 'white', padding: '25px', borderRadius: '12px', maxWidth: '900px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--gray-800)' }}>📄 Detalle de Cierre: {selectedCierre.locales?.nombre}</h3>
                                <p style={{ margin: '5px 0 0', fontSize: '0.8rem', color: '#64748b' }}>ID: {selectedCierre.id} | Fecha: {new Date(selectedCierre.fecha).toLocaleDateString('es-AR')}</p>
                            </div>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCierre(null)} style={{ fontSize: '1.2rem' }}>✕</button>
                        </div>
                        
                        <div className="table-responsive">
                            <table className="admin-table" style={{ fontSize: '0.8rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th>Pedido</th>
                                        <th>Cliente</th>
                                        <th>Fecha Pedido</th>
                                        <th>Método</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                        <th style={{ textAlign: 'right', color: 'var(--red-600)' }}>Comisión</th>
                                        <th style={{ textAlign: 'right', fontWeight: 700 }}>Neto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(selectedCierre.datos_detallados || []).map(p => (
                                        <tr key={p.id}>
                                            <td style={{ fontWeight: 600 }}>#{p.id.slice(0, 8)}</td>
                                            <td>{p.cliente}</td>
                                            <td style={{ fontSize: '0.7rem' }}>{new Date(p.hora).toLocaleString('es-AR')}</td>
                                            <td>{p.metodo}</td>
                                            <td style={{ textAlign: 'right' }}>${p.total}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--red-600)' }}>-${p.comision_monto}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>${(Number(p.total) - Number(p.comision_monto)).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'var(--gray-50)', fontWeight: 700 }}>
                                        <td colSpan="4" style={{ textAlign: 'right', padding: '15px' }}>TOTALES DEL CIERRE:</td>
                                        <td style={{ textAlign: 'right' }}>${selectedCierre.total_subtotal}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--red-600)' }}>-${selectedCierre.total_comisiones}</td>
                                        <td style={{ textAlign: 'right', color: '#166534', fontSize: '1rem' }}>${selectedCierre.total_neto_local}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div style={{ marginTop: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', gap: '20px', fontSize: '0.85rem' }}>
                            <div><strong>💳 Transferencia:</strong> ${selectedCierre.total_transferencia}</div>
                            <div><strong>💵 Efectivo:</strong> ${selectedCierre.total_efectivo}</div>
                            <div style={{ color: 'var(--red-600)' }}><strong>⚠️ Comisión Pendiente (Efectivo):</strong> ${selectedCierre.comision_efectivo || '0.00'}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminReportes;
