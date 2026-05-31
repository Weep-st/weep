import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import * as api from '../services/api';
import toast from 'react-hot-toast';
import './Mundialista.css';

const Mundialista = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const [activeTab, setActiveTab] = useState('album');
    const [loading, setLoading] = useState(true);

    // Mundial Core States
    const [stats, setStats] = useState(null);
    const [config, setConfig] = useState(null);
    const [partidos, setPartidos] = useState([]);
    const [pronosticos, setPronosticos] = useState([]);
    const [misiones, setMisiones] = useState([]);
    const [calendario, setCalendario] = useState([]);
    const [figuritas, setFiguritas] = useState([]);
    const [userFiguritas, setUserFiguritas] = useState([]);
    const [ranking, setRanking] = useState([]);

    // Album Magazine State
    const [currentPage, setCurrentPage] = useState(0); // 0: Portada, 1: Especiales, 2-3: Argentina (facing), 4: Global, 5: Leyendas, 6: Contraportada
    const [scalonetaSubPage, setScalonetaSubPage] = useState(0); // 0: Lado Izquierdo (Pág 2), 1: Lado Derecho (Pág 3)
    const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobileView(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Sobres & Recycle State
    const [abriendoSobre, setAbriendoSobre] = useState(false);
    const [sobreRevelado, setSobreRevelado] = useState(null); // array of 3 figs
    const [selectedRecycle, setSelectedRecycle] = useState([]); // array of figIds

    // Prediction input values
    const [predInputs, setPredInputs] = useState({}); // { partidoId: { a: '', b: '' } }

    // Zoomed sticker state for full-screen view
    const [zoomedSticker, setZoomedSticker] = useState(null);

    // Install/Reminder Modal PWA
    const [showReminderModal, setShowReminderModal] = useState(false);

    // --- NUEVAS HERRAMIENTAS ADICIONALES (MISIONES, CUPONES Y MINIJUEGOS) ---
    // Accordion/Collapse states for Premios tab sections
    const [collapsedMisiones, setCollapsedMisiones] = useState(false);
    const [collapsedPronosticos, setCollapsedPronosticos] = useState(true);
    const [collapsedCalendario, setCollapsedCalendario] = useState(true);
    const [collapsedCupon, setCollapsedCupon] = useState(true);
    // Cupones
    const [couponCode, setCouponCode] = useState('');
    const [redeemingCoupon, setRedeemingCoupon] = useState(false);

    // Misión fotos
    const [previewUrls, setPreviewUrls] = useState({}); // { misionId: url }
    const [uploadingMisionId, setUploadingMisionId] = useState(null);
    const [pendingVerifications, setPendingVerifications] = useState([]); // Array of misionIds

    // Minijuego Penales
    const [activeMinigameMision, setActiveMinigameMision] = useState(null);
    const [penaltyState, setPenaltyState] = useState({
        attempts: 0,
        score: 0,
        status: 'idle', // 'idle' | 'playing' | 'shot_result' | 'won' | 'lost'
        goalieDir: '',
        shotDir: '',
        message: ''
    });

    // Minijuego Trivia
    const [triviaMision, setTriviaMision] = useState(null);
    const [triviaIndex, setTriviaIndex] = useState(0);
    const [triviaScore, setTriviaScore] = useState(0);
    const [triviaStatus, setTriviaStatus] = useState('idle'); // 'idle' | 'playing' | 'won' | 'lost'
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);

    const triviaQuestions = [
        {
            question: "¿En qué país se jugará la final del Mundial 2026?",
            options: ["México", "Estados Unidos", "Canadá", "Argentina"],
            correct: 1 // Estados Unidos
        },
        {
            question: "¿Cuántas selecciones participarán en el Mundial 2026?",
            options: ["32", "40", "48", "64"],
            correct: 2 // 48
        },
        {
            question: "¿Quién es el máximo goleador histórico de la Selección Argentina en Mundiales?",
            options: ["Diego Maradona", "Lionel Messi", "Gabriel Batistuta", "Hernán Crespo"],
            correct: 1 // Lionel Messi
        }
    ];

    const handleRedeemCoupon = async (e) => {
        e.preventDefault();
        if (!couponCode.trim()) {
            toast.error('Ingresá un código de cupón.');
            return;
        }
        setRedeemingCoupon(true);
        try {
            const res = await api.canjearCuponMundialista(user.id, couponCode);
            if (res.success) {
                let prizeMsg = '';
                if (res.tipo === 'puntos') {
                    prizeMsg = `Recibiste +${res.cantidad} puntos de campaña ⭐`;
                } else if (res.tipo === 'sobre_figuritas') {
                    prizeMsg = `Recibiste +${res.cantidad} sobres de figuritas ✉️`;
                } else if (res.tipo === 'figurita_especifica') {
                    prizeMsg = `Recibiste la figurita #${res.figurita} 🖼️`;
                }
                toast.success(`¡Cupón canjeado! ${prizeMsg}`, { duration: 6000, icon: '🎟️' });
                setCouponCode('');
                loadAllData();
            } else {
                toast.error(res.message);
            }
        } catch (err) {
            toast.error('Error al procesar el cupón.');
            console.error(err);
        } finally {
            setRedeemingCoupon(false);
        }
    };

    const handleImageChange = (e, misionId) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrls({ ...previewUrls, [misionId]: url });
        }
    };

    const handleUploadPhoto = async (misionId) => {
        setUploadingMisionId(misionId);
        setTimeout(() => {
            setPendingVerifications([...pendingVerifications, misionId]);
            setUploadingMisionId(null);
            toast.success('¡Foto cargada y enviada! Un administrador revisará la foto con tu camiseta y te otorgará los puntos en breve.', { duration: 6000, icon: '📸' });
        }, 1800);
    };

    const startPenaltyGame = (mision) => {
        setActiveMinigameMision(mision);
        setPenaltyState({
            attempts: 0,
            score: 0,
            status: 'playing',
            goalieDir: '',
            shotDir: '',
            message: 'Elegí hacia dónde patear el penal.'
        });
    };

    const handlePenaltyShot = (direction) => {
        if (penaltyState.status !== 'playing') return;

        const dirs = ['izquierda', 'centro', 'derecha'];
        const goalieDir = dirs[Math.floor(Math.random() * 3)];
        const isGoal = direction !== goalieDir;
        const newScore = isGoal ? penaltyState.score + 1 : penaltyState.score;
        const newAttempts = penaltyState.attempts + 1;

        let nextStatus = 'shot_result';
        let msg = isGoal ? '⚽ ¡GOOOLAZOOO! El arquero voló para el otro lado.' : '❌ ¡ATAJADO! El arquero adivinó tu tiro.';

        setPenaltyState({
            ...penaltyState,
            attempts: newAttempts,
            score: newScore,
            goalieDir,
            shotDir: direction,
            status: nextStatus,
            message: msg
        });

        setTimeout(async () => {
            if (newAttempts >= 3) {
                if (newScore >= 2) {
                    setPenaltyState(prev => ({ ...prev, status: 'won', message: `🏆 ¡GANASTE EL MINIJUEGO! Metiste ${newScore} goles de 3. Reclamando tus puntos...` }));
                    try {
                        const res = await api.completarMisionCliente(user.id, activeMinigameMision.id, activeMinigameMision.puntos_premio, activeMinigameMision.sobres_premio || 0);
                        if (res.success) {
                            toast.success(res.message, { icon: '🏆' });
                            loadAllData();
                        } else {
                            toast.error(res.message);
                        }
                    } catch (e) {
                        toast.error('Error al registrar victoria del minijuego.');
                    }
                } else {
                    setPenaltyState(prev => ({ ...prev, status: 'lost', message: `😢 Perdiste. Metiste solo ${newScore} gol(es). ¡Intentá de nuevo!` }));
                }
            } else {
                setPenaltyState(prev => ({
                    ...prev,
                    status: 'playing',
                    attempts: newAttempts,
                    score: newScore,
                    goalieDir: '',
                    shotDir: '',
                    message: `Llevás ${newScore} gol(es). Siguiente penal: ¡Elegí dónde patear!`
                }));
            }
        }, 2000);
    };

    const startTriviaGame = (mision) => {
        setTriviaMision(mision);
        setTriviaIndex(0);
        setTriviaScore(0);
        setTriviaStatus('playing');
        setSelectedAnswer(null);
        setShowAnswerFeedback(false);
    };

    const handleAnswerSelect = (optionIndex) => {
        if (showAnswerFeedback) return;
        setSelectedAnswer(optionIndex);
        setShowAnswerFeedback(true);

        const isCorrect = optionIndex === triviaQuestions[triviaIndex].correct;
        const finalScore = isCorrect ? triviaScore + 1 : triviaScore;
        setTriviaScore(finalScore);

        setTimeout(async () => {
            const nextIndex = triviaIndex + 1;
            if (nextIndex >= triviaQuestions.length) {
                if (finalScore >= 2) {
                    setTriviaStatus('won');
                    try {
                        const res = await api.completarMisionCliente(user.id, triviaMision.id, triviaMision.puntos_premio, triviaMision.sobres_premio || 0);
                        if (res.success) {
                            toast.success(res.message, { icon: '🧠' });
                            loadAllData();
                        } else {
                            toast.error(res.message);
                        }
                    } catch (e) {
                        toast.error('Error al registrar tu puntaje.');
                    }
                } else {
                    setTriviaStatus('lost');
                }
            } else {
                setTriviaIndex(nextIndex);
                setSelectedAnswer(null);
                setShowAnswerFeedback(false);
            }
        }, 1500);
    };


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
                        width: '32px', 
                        height: '22px', 
                        objectFit: 'cover', 
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        verticalAlign: 'middle'
                    }} 
                />
            );
        }
        return <span style={{ fontSize: '1.4rem', verticalAlign: 'middle' }}>{flag}</span>;
    };

    // Helper: Format date forcing UTC and 24h to avoid -3h browser offset
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

    // Helper: Get active campaign day based on June 11 to July 19, 2026 dates
    const getActiveCampaignDay = () => {
        const now = new Date();
        const startDate = new Date(2026, 5, 11); // June 11 (Month index 5)
        
        // Si estamos antes del 11/06/2026, el día de pruebas activo es el Día 1
        if (now < startDate) {
            return 1;
        }
        
        const diffTime = now - startDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        if (diffDays < 1) return 1;
        if (diffDays > 39) return 39;
        return diffDays;
    };

    // Helper: Get the date text for a specific campaign day
    const getDateOfCampaignDay = (dia) => {
        const startDate = new Date(2026, 5, 11);
        const targetDate = new Date(startDate.getTime() + (dia - 1) * 24 * 60 * 60 * 1000);
        return targetDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    };

    useEffect(() => {
        if (!user) {
            toast.error('Debes iniciar sesión para ingresar a la Campaña Mundialista.');
            navigate('/pedir');
            return;
        }
        loadAllData();
        triggerDailyLogin();
    }, [user]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [
                st,
                conf,
                pts,
                prons,
                mis,
                cal,
                catalog,
                { data: uFigs },
                rk
            ] = await Promise.all([
                api.getMundialUsuarioStats(user.id),
                api.getMundialConfig(),
                api.getMundialPartidos(),
                api.getMundialPronosticos(user.id),
                api.getMundialMisiones(user.id),
                api.getMundialCalendario(user.id),
                api.getMundialFiguritas(),
                supabase.from('mundial_usuario_figuritas').select('*').eq('usuario_id', user.id),
                api.getMundialRanking()
            ]);

            setStats(st);
            setConfig(conf);
            setPartidos(pts);
            setPronosticos(prons);
            
            // Map initial inputs for prediction
            const inputs = {};
            pts.forEach(p => {
                const pr = prons.find(x => x.partido_id === p.id);
                inputs[p.id] = {
                    a: pr ? pr.pronostico_a : '',
                    b: pr ? pr.pronostico_b : ''
                };
            });
            setPredInputs(inputs);

            setMisiones(mis);
            setCalendario(cal);
            setFiguritas(catalog);
            setUserFiguritas(uFigs || []);
            setRanking(rk);

        } catch (err) {
            toast.error('Error al cargar datos mundialistas');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const triggerDailyLogin = async () => {
        try {
            const res = await api.completarLoginMision(user.id);
            if (res?.success && res?.message?.includes('+20')) {
                toast.success(res.message, { icon: '🔥' });
                // Reload stats
                const st = await api.getMundialUsuarioStats(user.id);
                setStats(st);
                const mis = await api.getMundialMisiones(user.id);
                setMisiones(mis);
            }
        } catch (e) {
            console.error("Error auto login check-in:", e);
        }
    };

    // --- PRONOSTICOS ---
    const handleSavePrediction = async (partidoId) => {
        const input = predInputs[partidoId];
        if (input.a === '' || input.b === '') {
            toast.error('Completa los goles de ambos equipos.');
            return;
        }

        try {
            await api.saveMundialPronostico(user.id, partidoId, Number(input.a), Number(input.b));
            toast.success('¡Pronóstico registrado con éxito! ⚽');
            // Reload predictions
            const prons = await api.getMundialPronosticos(user.id);
            setPronosticos(prons);
        } catch (err) {
            toast.error('Error al guardar pronóstico');
        }
    };

    // --- CALENDARIO RECLAMOS ---
    const handleClaimReward = async (diaItem) => {
        if (diaItem.reclamado) return;
        
        const activeDay = getActiveCampaignDay();
        if (diaItem.dia > activeDay) {
            toast.error(`Este premio estará disponible el día ${getDateOfCampaignDay(diaItem.dia)} 📅`);
            return;
        }

        const loadToast = toast.loading('Procesando tu premio...');
        try {
            const res = await api.reclamarDiaCalendario(user.id, diaItem.dia);
            toast.dismiss(loadToast);
            if (res.success) {
                toast.success(res.message, { duration: 5000, icon: '🎉' });
                loadAllData();
            } else {
                toast.error(res.message);
            }
        } catch (err) {
            toast.dismiss(loadToast);
            toast.error('Error al reclamar el premio');
        }
    };

    // --- SOBRES ---
    const handleOpenSobre = async () => {
        if (!stats || stats.sobres_disponibles < 1) {
            toast.error('No tienes paquetes de figuritas disponibles. ¡Completa misiones o ordena comida para conseguir más!');
            return;
        }

        setAbriendoSobre(true);
        setSobreRevelado(null);
        try {
            const res = await api.abrirSobreMundialista(user.id);
            if (res.success) {
                // Simular animación de apertura de 2.2 segundos
                setTimeout(() => {
                    setSobreRevelado(res.figuritas);
                    setAbriendoSobre(false);
                    loadAllData();
                }, 2200);
            } else {
                toast.error(res.message);
                setAbriendoSobre(false);
            }
        } catch (err) {
            toast.error('Error al abrir sobre');
            setAbriendoSobre(false);
        }
    };

    // --- PEGAR FIGURITA ---
    const handleGlueSticker = async (figId, numero) => {
        const loadToast = toast.loading(`Pegando figurita #${numero}...`);
        try {
            const res = await api.pegarFiguritaMundialista(user.id, figId);
            toast.dismiss(loadToast);
            if (res.success) {
                toast.success(`¡Figurita #${numero} pegada con éxito! ✨`);
                // Trigger glow/sparkle animation
                loadAllData();
            } else {
                toast.error(res.message);
            }
        } catch (err) {
            toast.dismiss(loadToast);
            toast.error('Error al pegar figurita');
        }
    };

    // --- RECYCLE REPETIDAS ---
    const handleSelectRecycle = (figId) => {
        if (selectedRecycle.includes(figId)) {
            setSelectedRecycle(selectedRecycle.filter(id => id !== figId));
        } else {
            if (selectedRecycle.length >= 3) {
                toast.error('Ya seleccionaste 3 figuritas.');
                return;
            }
            setSelectedRecycle([...selectedRecycle, figId]);
        }
    };

    const handleRecycle = async () => {
        if (selectedRecycle.length !== 3) {
            toast.error('Debes seleccionar exactamente 3 figuritas repetidas.');
            return;
        }

        const loadToast = toast.loading('Reciclando tus figuritas repetidas...');
        try {
            const res = await api.reciclarRepetidasMundialista(user.id, selectedRecycle[0], selectedRecycle[1], selectedRecycle[2]);
            toast.dismiss(loadToast);
            if (res.success) {
                toast.success(res.message, { icon: '🔄', duration: 4000 });
                setSelectedRecycle([]);
                loadAllData();
            } else {
                toast.error(res.message);
            }
        } catch (err) {
            toast.dismiss(loadToast);
            toast.error('Error al procesar reciclaje');
        }
    };

    // Helper: Obtener estado de figuritas en el album
    const getStickerStatus = (num) => {
        const figCatalogItem = figuritas.find(f => f.numero === num);
        if (!figCatalogItem) return { exists: false };

        const userInventoryItem = userFiguritas.find(uf => uf.figurita_id === figCatalogItem.id);
        return {
            exists: true,
            catalog: figCatalogItem,
            owned: !!userInventoryItem,
            pegada: userInventoryItem ? userInventoryItem.pegada : false,
            cantidadRepetida: userInventoryItem ? (userInventoryItem.cantidad || 0) : 0,
            dbId: figCatalogItem.id
        };
    };

    // Álbum Revista Page Renderer
    const renderAlbumPage = () => {
        // Calcular estadísticas del álbum
        const totalPegadas = userFiguritas.filter(uf => uf.pegada).length;
        const totalFiguritas = 39;
        const percentCompletado = Math.round((totalPegadas / totalFiguritas) * 100);

        if (currentPage === 0) {
            const coverImageUrl = isMobileView
                ? 'https://i.postimg.cc/HLsRv7vS/Chat-GPT-Image-May-30-2026-09-42-52-PM.png'
                : 'https://i.postimg.cc/vZvCvvhV/Chat-GPT-Image-May-30-2026-09-42-59-PM.png';

            return (
                <div 
                    className="album-revista-page portada" 
                    onClick={() => setCurrentPage(1)} 
                    style={{ 
                        padding: 0, 
                        overflow: 'hidden', 
                        minHeight: isMobileView ? '450px' : '580px', 
                        position: 'relative',
                        border: '2px solid var(--gold-primary)',
                        borderRadius: '16px'
                    }}
                >
                    <img 
                        src={coverImageUrl} 
                        alt="Álbum Oficial Portada" 
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            borderRadius: '14px'
                        }} 
                    />
                    {/* Premium glassmorphism overlay for prompt */}
                    <div 
                        className="portada-overlay-tap"
                        style={{
                            position: 'absolute',
                            bottom: '24px',
                            left: 0,
                            right: 0,
                            margin: '0 auto',
                            width: 'fit-content',
                            background: 'rgba(198, 40, 40, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#ffffff',
                            padding: isMobileView ? '10px 22px' : '12px 28px',
                            borderRadius: '50px',
                            fontSize: isMobileView ? '0.82rem' : '0.9rem',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 15px var(--wepi-red-glow)',
                            pointerEvents: 'none',
                            animation: 'pulse 1.8s infinite',
                            textAlign: 'center'
                        }}
                    >
                        {isMobileView ? '¡TOCÁ PARA ABRIR! 📖' : '¡HAZ CLIC AQUÍ PARA ABRIR! 📖'}
                    </div>
                </div>
            );
        }

        if (currentPage === 1) {
            // Página 1 (Pág 1 del álbum físico): Wepi y el Mundial (30 a 38)
            // Incluye: Logo Wepi, Mascota Wepi, Logo Mundial, Países Anfitriones y Mascotas Mundial
            return (
                <div className="album-revista-page pag-normal animate-page-flip">
                    <div className="page-header-premium" style={{ marginBottom: '15px' }}>
                        <span>Pág 1</span>
                        <h3 className="argentina-title" style={{ color: '#fbbf24' }}>🌍 Wepi • Bienvenidos al Mundial 2026</h3>
                    </div>
                    
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', marginTop: '-10px', marginBottom: '20px' }}>
                        El puntapié inicial de la fiesta: Coleccioná los stickers corporativos de Wepi, logos del torneo y las mascotas oficiales.
                    </p>

                    <div className="argentina-grid">
                        {[30, 31, 32, 33, 34, 35, 36, 37, 38].map(num => renderStickerSlot(num))}
                    </div>
                </div>
            );
        }

        if (currentPage === 2) {
            // Página 2 (Pág 2 y 3 del álbum físico): SELECCIÓN ARGENTINA LADO A LADO
            // Slots 27,28,29 + 1-12 a la izquierda, 13-26 a la derecha
            const page2Slots = [27, 28, 29, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
            const page3Slots = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];

            if (isMobileView) {
                if (scalonetaSubPage === 0) {
                    return (
                        <div className="album-revista-page carilla-izq mobile-single-page animate-page-flip">
                            <div className="page-header-premium">
                                <span>Pág 2 (Parte A)</span>
                                <h3 className="argentina-title">🇦🇷 La Scaloneta</h3>
                            </div>
                            <div className="argentina-grid">
                                {[27, 28, 29, 1, 2, 3, 4, 5, 6, 7].map(num => renderStickerSlot(num))}
                            </div>
                        </div>
                    );
                } else if (scalonetaSubPage === 1) {
                    return (
                        <div className="album-revista-page carilla-der mobile-single-page animate-page-flip">
                            <div className="page-header-premium">
                                <span>Pág 2 (Parte B)</span>
                                <h3 className="argentina-title">🇦🇷 Campeones del Mundo</h3>
                            </div>
                            <div className="argentina-grid">
                                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(num => renderStickerSlot(num))}
                            </div>
                        </div>
                    );
                } else {
                    return (
                        <div className="album-revista-page carilla-der mobile-single-page animate-page-flip">
                            <div className="page-header-premium">
                                <span>Pág 3</span>
                                <h3 className="argentina-title">🇦🇷 Estrellas de Selección</h3>
                            </div>
                            <div className="argentina-grid">
                                {[18, 19, 20, 21, 22, 23, 24, 25, 26].map(num => renderStickerSlot(num))}
                            </div>
                        </div>
                    );
                }
            }

            return (
                <div className="album-revista-double-page">
                    {/* Carilla Izquierda (Pág 2) */}
                    <div className="album-revista-page carilla-izq">
                        <div className="page-header-premium">
                            <span>Pág 2</span>
                            <h3 className="argentina-title">🇦🇷 La Scaloneta</h3>
                        </div>
                        <div className="argentina-grid">
                            {page2Slots.map(num => renderStickerSlot(num))}
                        </div>
                    </div>

                    {/* Carilla Derecha (Pág 3) */}
                    <div className="album-revista-page carilla-der">
                        <div className="page-header-premium">
                            <span>Pág 3</span>
                            <h3 className="argentina-title">🇦🇷 Campeones del Mundo</h3>
                        </div>
                        <div className="argentina-grid">
                            {page3Slots.map(num => renderStickerSlot(num))}
                        </div>
                    </div>
                </div>
            );
        }

        if (currentPage === 3) {
            // Página 3 (Pág 4 del álbum físico): Salón de la Fama (figurita 39)
            return (
                <div 
                    className="album-revista-page pag-normal animate-page-flip" 
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        minHeight: isMobileView ? '430px' : '520px', 
                        background: 'radial-gradient(circle, rgba(251, 191, 36, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%)', 
                        border: '2px dashed var(--gold-primary)', 
                        borderRadius: '16px',
                        padding: '30px'
                    }}
                >
                    <div className="page-header-premium" style={{ width: '100%', textAlign: 'center', marginBottom: '15px' }}>
                        <span>Pág 4</span>
                        <h3 style={{ color: 'var(--gold-primary)', margin: 0, textShadow: '0 0 10px rgba(251, 191, 36, 0.3)' }}>🏆 Leyenda de Leyendas</h3>
                    </div>
                    
                    <p style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', margin: '-10px 0 24px 0', maxWidth: '300px', lineHeight: '1.4' }}>
                        El lugar dorado reservado únicamente para la historia viviente de nuestro fútbol y el Salón de la Fama de Wepi.
                    </p>

                    <div style={{ width: '150px', filter: 'drop-shadow(0 0 15px rgba(251, 191, 36, 0.4))', margin: '0 auto' }}>
                        {renderStickerSlot(39)}
                    </div>
                </div>
            );
        }

        if (currentPage === 4) {
            // Página 4 (Pág 6 del álbum físico): Contraportada
            return (
                <div className="album-revista-page contraportada">
                    <div className="contraportada-content">
                        <h3>Resumen del Álbum 📚</h3>
                        <div className="stat-circle-wrapper">
                            <div className="stat-circle-inner">
                                <span className="stat-num">{percentCompletado}%</span>
                                <span className="stat-lbl">Completado</span>
                            </div>
                        </div>
                        <div className="stats-list-box">
                            <div>👥 Figuritas Pegadas: <strong>{totalPegadas} / 39</strong></div>
                            <div>✉️ Sobres Abiertos: <strong>{(39 - (stats?.sobres_disponibles || 0))}</strong></div>
                        </div>
                        <p style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#64748b', marginTop: '20px' }}>"Todo lo que buscás, está en Wepi"</p>
                        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(0)} style={{ marginTop: '10px' }}>
                            Volver al Inicio 📖
                        </button>
                    </div>
                </div>
            );
        }
    };

    const renderStickerSlot = (num) => {
        const state = getStickerStatus(num);
        if (!state.exists) return null;

        return (
            <div key={num} className={`album-sticker-slot ${state.pegada ? 'pegada' : 'vacia'} ${state.catalog.rareza}`}>
                {state.pegada ? (
                    <div 
                        className="sticker-card-premium card-glow animate-sparkle"
                        onClick={() => setZoomedSticker(state.catalog)}
                        style={{ cursor: 'zoom-in' }}
                    >
                        <img src={state.catalog.foto_url || "https://i.postimg.cc/XqcCXxZr/buscamos-repartidores-(30).png"} alt={state.catalog.nombre} className="sticker-img" />
                        <div className="sticker-banner-footer">
                            <span className="st-num">#{state.catalog.numero}</span>
                            <span className="st-name">{state.catalog.nombre}</span>
                        </div>
                    </div>
                ) : (
                    <div className="sticker-silhouette">
                        <span className="silhouette-trophy">🏆</span>
                        <span className="silhouette-num">#{num}</span>
                        {state.owned && state.cantidadRepetida > 0 && (
                            <button 
                                className="glue-prompt-btn"
                                onClick={() => handleGlueSticker(state.dbId, num)}
                            >
                                ¡PEGAR! ✨
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const handlePrevPage = () => {
        if (currentPage === 3 && isMobileView) {
            setCurrentPage(2);
            setScalonetaSubPage(2);
        } else if (currentPage === 2 && isMobileView) {
            if (scalonetaSubPage === 2) {
                setScalonetaSubPage(1);
            } else if (scalonetaSubPage === 1) {
                setScalonetaSubPage(0);
            } else {
                setCurrentPage(1);
            }
        } else {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage === 1 && isMobileView) {
            setCurrentPage(2);
            setScalonetaSubPage(0);
        } else if (currentPage === 2 && isMobileView) {
            if (scalonetaSubPage === 0) {
                setScalonetaSubPage(1);
            } else if (scalonetaSubPage === 1) {
                setScalonetaSubPage(2);
            } else {
                setCurrentPage(3);
            }
        } else {
            setCurrentPage(currentPage + 1);
        }
    };

    const getPageLabel = () => {
        if (currentPage === 0) return 'Portada';
        if (currentPage === 4) return 'Contraportada';
        if (currentPage === 1) {
            return 'Wepi y el Mundial (Pág 1)';
        }
        if (currentPage === 2) {
            if (isMobileView) {
                if (scalonetaSubPage === 0) return 'La Scaloneta (Pág 2A)';
                if (scalonetaSubPage === 1) return 'La Scaloneta (Pág 2B)';
                return 'La Scaloneta (Pág 2C)';
            }
            return 'La Scaloneta (Págs 2 y 3)';
        }
        if (currentPage === 3) return 'Salón de la Fama (Pág 4)';
        return `Página ${currentPage}`;
    };

    return (
        <div className="mundialista-container">
            {/* Header premium Dark - Wepi Coherent Branding */}
            <header className="mundialista-header">
                <Link to="/pedir" className="app-logo-link-mundial">
                    <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="app-logo-img-mundial" />
                </Link>
                <div className="header-campaign-title-mundial">
                    <h2>Campaña Mundialista</h2>
                </div>
                <div className="user-stats-pill">
                    <div className="stat-pill-item">
                        <span className="pill-icon">⭐</span>
                        <div className="pill-text">
                            <strong>{stats?.puntos_totales || 0}</strong>
                            <span>Puntos</span>
                        </div>
                    </div>
                    <div className="stat-pill-item">
                        <span className="pill-icon">✉️</span>
                        <div className="pill-text">
                            <strong>{stats?.sobres_disponibles || 0}</strong>
                            <span>Sobres</span>
                        </div>
                    </div>
                </div>
            </header>

            <nav className="mundial-tabs-nav">
                <button className={activeTab === 'album' ? 'active' : ''} onClick={() => setActiveTab('album')}>
                    📖 {isMobileView ? 'Álbum' : 'Álbum'}
                </button>
                <button className={activeTab === 'premios' ? 'active' : ''} onClick={() => setActiveTab('premios')}>
                    🎁 {isMobileView ? 'Misiones' : 'Misiones y Regalos'}
                </button>
                <button className={activeTab === 'ranking' ? 'active' : ''} onClick={() => setActiveTab('ranking')}>
                    🏆 {isMobileView ? 'Ranking' : 'Ranking Local'}
                </button>
                <button className={activeTab === 'fixture' ? 'active' : ''} onClick={() => setActiveTab('fixture')}>
                    🗓️ {isMobileView ? 'Fixture' : 'Fixture'}
                </button>
            </nav>

            <main className="mundial-main-content">
                {/* Banner de Campaña Configurable */}
                {config?.banner_url && (
                    <div className="mundialista-campaign-banner-container" style={{ width: '100%', marginBottom: '20px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: config.banner_link ? 'pointer' : 'default' }}>
                        {config.banner_link ? (
                            <a href={config.banner_link} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                <img src={config.banner_url} alt="Campaña Mundialista Banner" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '180px', objectFit: 'cover' }} />
                            </a>
                        ) : (
                            <img src={config.banner_url} alt="Campaña Mundialista Banner" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '180px', objectFit: 'cover' }} />
                        )}
                    </div>
                )}
                {/* 1. SECCION ALBUM */}
                {activeTab === 'album' && (
                    <div className="album-module-wrapper">
                        {/* Revista Fiel Layout */}
                        <div className="magazine-booklet-container">
                            {renderAlbumPage()}
                        </div>

                        <div className="album-controls-top">
                            <button 
                                className="btn btn-secondary" 
                                disabled={currentPage === 0}
                                onClick={handlePrevPage}
                            >
                                ◀ Página Anterior
                            </button>
                            <span className="page-indicator-label">
                                {getPageLabel()}
                            </span>
                            <button 
                                className="btn btn-secondary" 
                                disabled={currentPage === 4}
                                onClick={handleNextPage}
                            >
                                Página Siguiente ▶
                            </button>
                        </div>

                        {/* Tray de Acciones del Álbum (Deck y Sobres) */}
                        <div className="album-deck-tray">
                            <div className="sobres-shop-box">
                                <h3>✉️ Paquetes de Figuritas</h3>
                                <p>Tienes <strong>{stats?.sobres_disponibles || 0}</strong> sobre(s) cerrado(s).</p>
                                <button 
                                    className="btn btn-primary animate-pulse" 
                                    disabled={abriendoSobre || (stats?.sobres_disponibles || 0) < 1}
                                    onClick={handleOpenSobre}
                                    style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: 900 }}
                                >
                                    {abriendoSobre ? 'Abriendo sobre... 📦' : '¡ABRIR SOBRE CERRADO! ✉️'}
                                </button>
                                
                                {sobreRevelado && (
                                    <div className="sobre-revelado-overlay" onClick={() => setSobreRevelado(null)}>
                                        <div className="sobre-revelado-content animate-pop-in" onClick={e => e.stopPropagation()}>
                                            <h3>¡Abriste un Sobre Wepi! 🎉</h3>
                                            <div className="sobre-revelado-grid">
                                                {sobreRevelado.map(f => (
                                                    <div key={f.id} className={`revealed-card ${f.rareza}`}>
                                                        <img src={f.foto_url || "https://i.postimg.cc/XqcCXxZr/buscamos-repartidores-(30).png"} alt={f.nombre} />
                                                        <div className="card-lbl">
                                                            <strong>#{f.numero}</strong>
                                                            <span>{f.nombre}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button className="btn btn-primary" onClick={() => setSobreRevelado(null)} style={{ marginTop: '20px' }}>
                                                Guardar en mi Deck 💾
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Deck - Inventario de Figuritas sin pegar */}
                            <div className="user-deck-box">
                                <h3>🃏 Tus Figuritas sin Pegar</h3>
                                <div className="deck-scroll">
                                    {figuritas.map(f => {
                                        const state = getStickerStatus(f.numero);
                                        const ungluedCount = userFiguritas.find(uf => uf.figurita_id === f.id && !uf.pegada)?.cantidad || 0;
                                        if (ungluedCount < 1) return null;

                                        return (
                                            <div key={f.id} className={`deck-sticker-card ${f.rareza}`} onClick={() => handleGlueSticker(f.id, f.numero)}>
                                                <img src={f.foto_url || "https://i.postimg.cc/XqcCXxZr/buscamos-repartidores-(30).png"} alt={f.nombre} />
                                                <span className="deck-qty-badge">x{ungluedCount}</span>
                                                <div className="deck-card-lbl">#{f.numero}</div>
                                            </div>
                                        );
                                    })}
                                    {userFiguritas.filter(uf => !uf.pegada && uf.cantidad > 0).length === 0 && (
                                        <p style={{ color: '#64748b', fontSize: '0.85rem', width: '100%', textAlign: 'center', padding: '20px 0' }}>
                                            No tienes figuritas sin pegar en tu bandeja. ¡Abre sobres para coleccionar!
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Mercadito de Trueque (Quema de Repetidas 3 por 1) */}
                            <div className="recycle-trueque-box">
                                <h3>🔄 Mercado de Trueques</h3>
                                <p>Canjeá 3 figuritas repetidas a cambio de <strong>1 sobre cerrado gratis</strong> ✉️.</p>
                                <div className="recycle-grid">
                                    {figuritas.map(f => {
                                        const state = getStickerStatus(f.numero);
                                        // Tiene repetidas si cantidad > 1 (o si pegada es true y cantidad >= 1, o pegada es false y cantidad >= 2)
                                        const pegada = state.pegada;
                                        const totalQty = userFiguritas.find(uf => uf.figurita_id === f.id)?.cantidad || 0;
                                        const repetidas = pegada ? totalQty : Math.max(0, totalQty - 1);
                                        if (repetidas < 1) return null;

                                        return (
                                            <div 
                                                key={f.id} 
                                                className={`recycle-item ${selectedRecycle.includes(f.id) ? 'selected' : ''}`}
                                                onClick={() => handleSelectRecycle(f.id)}
                                            >
                                                <img src={f.foto_url || "https://i.postimg.cc/XqcCXxZr/buscamos-repartidores-(30).png"} alt={f.nombre} />
                                                <span className="recycle-qty">x{repetidas}</span>
                                                <div className="recycle-checkbox">{selectedRecycle.includes(f.id) ? '✓' : '+'}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '15px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        Seleccionadas: {selectedRecycle.length}/3
                                    </span>
                                    <button 
                                        className="btn btn-primary btn-sm"
                                        disabled={selectedRecycle.length !== 3}
                                        onClick={handleRecycle}
                                    >
                                        🔄 Canjear por Sobre
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Canjear Código de Regalo (Cupones) en la sección Álbum */}
                        <div className="album-coupon-redeem-card" style={{ width: '100%', maxWidth: '900px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '20px', boxSizing: 'border-box', marginTop: '20px' }}>
                            <h3 style={{ margin: '0 0 10px 0', color: 'var(--wepi-red)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '900', fontSize: '1.1rem' }}>
                                🎟️ Canjear Código de Regalo (Cupones)
                            </h3>
                            <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '0.82rem', lineHeight: '1.4' }}>
                                ¿Tenés un código especial de Wepi? Ingresalo abajo para obtener tus sobres gratis, puntos de campaña o figuritas especiales al instante.
                            </p>
                            <form onSubmit={handleRedeemCoupon} className="coupon-input-group">
                                <input 
                                    type="text" 
                                    placeholder="EJ: SCALONETA" 
                                    value={couponCode} 
                                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                    className="coupon-input"
                                />
                                <button 
                                    type="submit" 
                                    disabled={redeemingCoupon}
                                    className="btn btn-primary coupon-btn"
                                >
                                    {redeemingCoupon ? 'Procesando...' : 'Canjear'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 3. SECCION PREMIOS (MISIONES Y REGALOS) */}
                {activeTab === 'premios' && (
                    <div className="premios-module-wrapper animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {/* SECCION 1: MISIONES DIARIAS (Estática) */}
                        <div className="accordion-section">
                            <div className="accordion-header" style={{ cursor: 'default' }}>
                                <h3 className="accordion-title">
                                    ⚡ Misiones Diarias del Mundial
                                </h3>
                            </div>
                            
                            <div className="accordion-content">
                                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, marginBottom: '20px' }}>Cumplí las tareas del día para sumar puntos extras de campaña.</p>
                                <div className="misiones-list">
                                    {misiones.filter(m => m.tipo !== 'login_diario' && !m.titulo.toLowerCase().includes('ingreso diario')).map(m => (
                                        <div key={m.id} className={`mision-row-card ${m.completada ? 'completed' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div className="mision-check" style={{ fontSize: '1.2rem' }}>
                                                        {m.completada ? '✅' : '⏳'}
                                                    </div>
                                                    <div className="mision-info">
                                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'white' }}>{m.titulo}</h4>
                                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>{m.descripcion}</p>
                                                    </div>
                                                </div>
                                                <div className="mision-points" style={{ fontWeight: 'bold', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                                    {m.puntos_premio > 0 && <span style={{ color: '#10b981' }}>+{m.puntos_premio} Pts</span>}
                                                    {m.sobres_premio > 0 && <span style={{ color: '#fbbf24' }}>✉️ +{m.sobres_premio} {m.sobres_premio === 1 ? 'Sobre' : 'Sobres'}</span>}
                                                </div>
                                            </div>

                                            {!m.completada && (
                                                <div className="mision-interactive-action" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '8px', marginTop: '4px' }}>
                                                    {(m.tipo === 'imagen_verificacion' || m.tipo === 'link_verificacion') && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                                            {m.tipo === 'link_verificacion' && m.enlace_url && (
                                                                <div style={{ marginBottom: '6px' }}>
                                                                    <a 
                                                                        href={m.enlace_url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer" 
                                                                        className="btn btn-secondary btn-sm animate-pulse"
                                                                        style={{ padding: '8px 16px', fontSize: '0.78rem', fontWeight: 'bold', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid #fbbf24', color: '#fbbf24', borderRadius: '8px' }}
                                                                    >
                                                                        🔗 Completar en Enlace Externo
                                                                    </a>
                                                                </div>
                                                            )}
                                                            
                                                            {pendingVerifications.includes(m.id) ? (
                                                                <span style={{ fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                                                                    📸 Captura enviada • Pendiente de verificación
                                                                </span>
                                                            ) : (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {previewUrls[m.id] ? (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                            <img src={previewUrls[m.id]} alt="Preview" style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--wepi-red)' }} />
                                                                            <button className="btn btn-secondary btn-sm" onClick={() => handleClearImage(m.id)}>
                                                                                Quitar foto ❌
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', border: '1px dashed rgba(255,255,255,0.3)', width: 'fit-content' }}>
                                                                            <span>📷 Subir foto para completar</span>
                                                                            <input 
                                                                                type="file" 
                                                                                accept="image/*" 
                                                                                style={{ display: 'none' }} 
                                                                                onChange={(e) => handleImageSelect(e, m.id)} 
                                                                            />
                                                                        </label>
                                                                    )}
                                                                    {uploadingMisionId === m.id && (
                                                                        <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Subiendo archivo... 🚀</span>
                                                                    )}
                                                                    {previewUrls[m.id] && (
                                                                        <button 
                                                                            className="btn btn-primary btn-sm" 
                                                                            onClick={() => handleUploadVerification(m.id)}
                                                                            disabled={uploadingMisionId !== null}
                                                                            style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 'bold', width: 'fit-content' }}
                                                                        >
                                                                            Enviar Foto para Validar 📤
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {m.tipo === 'minijuego_penales' && (
                                                        <button 
                                                            className="btn btn-primary btn-sm" 
                                                            onClick={() => startPenalesGame(m)}
                                                            style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                        >
                                                            ⚽ Jugar Penales Wepi
                                                        </button>
                                                    )}

                                                    {m.tipo === 'minijuego_trivia' && (
                                                        <button 
                                                            className="btn btn-primary btn-sm" 
                                                            onClick={() => startTriviaGame(m)}
                                                            style={{ padding: '6px 14px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                        >
                                                            🧠 Responder Trivia
                                                        </button>
                                                    )}

                                                    {m.tipo === 'pedido' && (
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                            🍔 Hacé un pedido en Delivery para completar automáticamente.
                                                        </span>
                                                    )}

                                                    {m.tipo === 'pronostico' && (
                                                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                            🔮 Completá un pronóstico para cumplir esta misión.
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {misiones.filter(m => m.tipo !== 'login_diario' && !m.titulo.toLowerCase().includes('ingreso diario')).length === 0 && (
                                        <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '15px' }}>
                                            No hay misiones listadas para hoy. ¡Vuelve más tarde!
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ACCORDION 2: PRONOSTICOS DE ARGENTINA */}
                        <div className="accordion-section">
                            <div 
                                className="accordion-header"
                                onClick={() => setCollapsedPronosticos(!collapsedPronosticos)}
                            >
                                <h3 className="accordion-title">
                                    🔮 Predicciones de Argentina
                                </h3>
                                <div className={`accordion-toggle-btn ${collapsedPronosticos ? 'collapsed' : 'expanded'}`}>
                                    <span>{collapsedPronosticos ? 'Desplegar' : 'Contraer'}</span>
                                    <span className="arrow-icon">▼</span>
                                </div>
                            </div>
                            
                            {!collapsedPronosticos && (
                                <div className="accordion-content">
                                    <div className="info-box-mundial" style={{ margin: '0 0 20px 0', background: 'rgba(198, 40, 40, 0.05)', color: 'white', border: '1px solid rgba(198, 40, 40, 0.15)', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center' }}>
                                        💡 <strong>Acierto ganador o empate 100 pts y acierto exacto 250 pts</strong>
                                    </div>
                                    <div className="partidos-grid-mundial" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                                        {(() => {
                                            const argentinaMatches = partidos.filter(p => p.equipo_a === 'Argentina' || p.equipo_b === 'Argentina');
                                            
                                            if (argentinaMatches.length === 0) {
                                                return (
                                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
                                                        No hay partidos de la Selección Argentina disponibles para pronosticar en este momento.
                                                    </p>
                                                );
                                            }

                                            return argentinaMatches.map(p => {
                                                const pr = pronosticos.find(x => x.partido_id === p.id);
                                                const isLocked = new Date(p.fecha_partido) <= new Date() || p.estado === 'finalizado';
                                                const input = predInputs[p.id] || { a: '', b: '' };

                                                return (
                                                    <div key={p.id} className={`partido-card-glass ${isLocked ? 'locked' : ''}`} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px', color: 'white' }}>
                                                        <div className="partido-time-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '10px' }}>
                                                            <span>📅 {formatMatchDate(p.fecha_partido)}</span>
                                                            {isLocked ? (
                                                                <span className="lock-tag" style={{ color: '#f87171' }}>🔒 Bloqueado</span>
                                                            ) : (
                                                                <span className="lock-tag open" style={{ color: '#34d399' }}>⚽ Abierto</span>
                                                            )}
                                                        </div>

                                                        <div className="partido-team-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                            <div className="team-box left" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1', justifyContent: 'flex-start' }}>
                                                                 <span className="team-flag">{renderFlag(p.bandera_a)}</span>
                                                                 <span className="team-name" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{p.equipo_a}</span>
                                                            </div>

                                                            <div className="prediction-input-box" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                <input 
                                                                    type="number"
                                                                    disabled={isLocked}
                                                                    value={input.a}
                                                                    onChange={e => setPredInputs({
                                                                        ...predInputs,
                                                                        [p.id]: { ...input, a: e.target.value }
                                                                    })}
                                                                    placeholder="—"
                                                                    style={{ width: '40px', padding: '6px', textAlign: 'center', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontWeight: 'bold' }}
                                                                />
                                                                <span className="vs-sep" style={{ color: '#64748b' }}>-</span>
                                                                <input 
                                                                    type="number"
                                                                    disabled={isLocked}
                                                                    value={input.b}
                                                                    onChange={e => setPredInputs({
                                                                        ...predInputs,
                                                                        [p.id]: { ...input, b: e.target.value }
                                                                    })}
                                                                    placeholder="—"
                                                                    style={{ width: '40px', padding: '6px', textAlign: 'center', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontWeight: 'bold' }}
                                                                />
                                                            </div>

                                                            <div className="team-box right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1', justifyContent: 'flex-end' }}>
                                                                <span className="team-name" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{p.equipo_b}</span>
                                                                <span className="team-flag">{renderFlag(p.bandera_b)}</span>
                                                            </div>
                                                        </div>

                                                        {p.estado === 'finalizado' && (
                                                            <div className="actual-result-row" style={{ marginTop: '12px', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                                                <span>Resultado Real: <strong>{p.goles_a} - {p.goles_b}</strong></span>
                                                                <span className={`points-earned-badge ${pr?.puntos_ganados > 0 ? 'win' : 'lose'}`} style={{ color: pr?.puntos_ganados > 0 ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                                                                    +{pr?.puntos_ganados || 0} Pts
                                                                </span>
                                                            </div>
                                                        )}

                                                        {!isLocked && (
                                                            <button 
                                                                className="btn btn-primary btn-sm btn-full"
                                                                onClick={() => handleSavePrediction(p.id)}
                                                                style={{ marginTop: '12px', width: '100%', padding: '8px', fontSize: '0.8rem', fontWeight: 'bold' }}
                                                            >
                                                                {pr ? 'Actualizar Pronóstico 💾' : 'Registrar Pronóstico 💾'}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ACCORDION 3: CALENDARIO DE PREMIOS */}
                        <div className="accordion-section">
                            <div 
                                className="accordion-header"
                                onClick={() => setCollapsedCalendario(!collapsedCalendario)}
                            >
                                <h3 className="accordion-title">
                                    📅 Calendario de Premios Diario (11/06 al 19/07)
                                </h3>
                                <div className={`accordion-toggle-btn ${collapsedCalendario ? 'collapsed' : 'expanded'}`}>
                                    <span>{collapsedCalendario ? 'Desplegar' : 'Contraer'}</span>
                                    <span className="arrow-icon">▼</span>
                                </div>
                            </div>
                            
                            {!collapsedCalendario && (
                                <div className="accordion-content">
                                    <div className="calendar-header-desc">
                                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 0, lineHeight: '1.4' }}>Reclamá un premio diario durante la Copa del Mundo. ¡Ingresá cada día para reclamar nuevas recompensas en tu Wallet, paquetes de figuritas y puntos de campaña! 📅</p>
                                        <button 
                                            className="btn btn-secondary recordatorios-btn"
                                            onClick={() => setShowReminderModal(true)}
                                            style={{ marginTop: '8px', marginBottom: '20px', padding: '8px 16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer', borderRadius: '8px', fontWeight: 'bold' }}
                                        >
                                            🔔 Recibir Recordatorios Diarios
                                        </button>
                                    </div>
                                    
                                    <div className="calendar-grid-tiles">
                                        {calendario.map(c => {
                                            const activeDay = getActiveCampaignDay();
                                            const isClaimed = c.reclamado;
                                            const isExpired = c.dia < activeDay && !isClaimed;
                                            const isLocked = c.dia > activeDay && !isClaimed;
                                            const isCurrent = c.dia === activeDay && !isClaimed;
                                            
                                            return (
                                                <div 
                                                    key={c.dia} 
                                                    className={`calendar-tile ${isClaimed ? 'claimed' : ''} ${isExpired ? 'expired' : ''} ${isLocked ? 'locked' : ''} ${isCurrent ? 'claimable current' : ''}`}
                                                    onClick={() => isCurrent && handleClaimReward(c)}
                                                >
                                                    <span className="tile-day-lbl">Día {c.dia}</span>
                                                    <div className="tile-prize-indicator">
                                                        {c.premio_tipo === 'credito_wallet' ? (
                                                            <span className="wallet-reward-text">${c.premio_cantidad} Wallet</span>
                                                        ) : (
                                                            <span>{c.premio_tipo === 'sobre_figuritas' ? `✉️ x${c.premio_cantidad}` : `⭐ +${c.premio_cantidad}`}</span>
                                                        )}
                                                    </div>
                                                    <p className="tile-desc">{c.descripcion}</p>
                                                    
                                                    <span className={`tile-status-tag ${isClaimed ? 'claimed' : ''} ${isExpired ? 'expired' : ''} ${isLocked ? 'locked' : ''} ${isCurrent ? 'current' : ''}`}>
                                                        {isClaimed ? 'Reclamado ✓' : (isExpired ? 'Vencido' : (isLocked ? 'Bloqueado' : '¡Reclamar! ✨'))}
                                                    </span>

                                                    <div className="tile-status-overlay">
                                                        {isClaimed ? 'RECLAMADO ✓' : (isExpired ? '⏳ VENCIDO' : (isLocked ? '🔒 BLOQUEADO' : '¡RECLAMAR! ✨'))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>



                    </div>
                )}

                {/* 4. SECCION RANKING */}
                {activeTab === 'ranking' && (
                    <div className="ranking-module-wrapper">
                        <h3>🏆 Tabla de Posiciones Global</h3>
                        <p style={{ color: 'var(--gray-600)', fontSize: '0.85rem', marginTop: '-10px', marginBottom: '20px' }}>Los usuarios de Wepi que sumen mayor puntuación al final de la copa recibirán premios exclusivos.</p>
                        
                        <div className="ranking-table-card">
                            <div className="ranking-table-header">
                                <span>Puesto</span>
                                <span>Usuario</span>
                                <span>Puntos Totales</span>
                            </div>
                            <div className="ranking-rows-list">
                                {ranking.map(r => {
                                    const isCurrentUser = r.usuario_id === user.id;

                                    return (
                                        <div key={r.posicion} className={`ranking-row-item ${isCurrentUser ? 'current-user-row' : ''}`}>
                                            <div className="pos-badge">
                                                {r.posicion === 1 ? '🥇' : (r.posicion === 2 ? '🥈' : (r.posicion === 3 ? '🥉' : `#${r.posicion}`))}
                                            </div>
                                            <div className="user-name-cell">
                                                {r.nombre} {isCurrentUser && <span className="you-lbl">(Tú)</span>}
                                            </div>
                                            <div className="user-points-cell">
                                                {r.puntos} Pts
                                            </div>
                                        </div>
                                    );
                                })}
                                {ranking.length === 0 && (
                                    <p style={{ color: '#64748b', textAlign: 'center', padding: '30px' }}>Cargando tabla de posiciones...</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. SECCION FIXTURE */}
                {activeTab === 'fixture' && (
                    <div className="fixture-module-wrapper animate-fade-in">

                        {/* Listar partidos agrupados por su propiedad 'fase' */}
                        {(() => {
                            // Agrupar partidos por fase
                            const groups = {};
                            partidos.forEach(p => {
                                const f = p.fase || 'Fase de Grupos';
                                if (!groups[f]) groups[f] = [];
                                groups[f].push(p);
                            });

                            // Orden de fases deseado
                            const fasesOrdenadas = [
                                'Fase de Grupos',
                                'Octavos de Final',
                                'Cuartos de Final',
                                'Semifinales',
                                'Tercer Puesto',
                                'Final'
                            ];

                            // Agregar cualquier fase que no esté en el orden predeterminado
                            Object.keys(groups).forEach(key => {
                                if (!fasesOrdenadas.includes(key)) {
                                    fasesOrdenadas.push(key);
                                }
                            });

                            return fasesOrdenadas.map(fase => {
                                const matchesInPhase = groups[fase] || [];
                                if (matchesInPhase.length === 0) return null;

                                return (
                                    <div key={fase} className="fixture-phase-group" style={{ marginBottom: '35px' }}>
                                        <h3 className="fixture-phase-title" style={{ fontSize: '1.2rem', color: 'var(--wepi-red)', borderBottom: '2px solid rgba(198, 40, 40, 0.15)', paddingBottom: '8px', marginBottom: '15px', fontWeight: '900' }}>
                                            🏆 {fase}
                                        </h3>
                                        <div className="fixture-matches-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                                            {matchesInPhase.map(p => {
                                                const isFinalizado = p.estado === 'finalizado';
                                                const isEnCurso = p.estado === 'en_curso';

                                                return (
                                                    <div 
                                                        key={p.id} 
                                                        className={`fixture-match-card ${isFinalizado ? 'finalized' : (isEnCurso ? 'live' : '')}`}
                                                        style={{
                                                            background: 'rgba(255, 255, 255, 0.95)',
                                                            border: isEnCurso ? '1.5px solid #fbbf24' : '1px solid rgba(0,0,0,0.06)',
                                                            borderRadius: '16px',
                                                            padding: '14px',
                                                            boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
                                                            transition: 'all 0.2s',
                                                            position: 'relative'
                                                        }}
                                                    >
                                                        <div className="match-card-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '10px' }}>
                                                            <span style={{ fontWeight: '600' }}>📅 {formatMatchDate(p.fecha_partido)}</span>
                                                            <span style={{ 
                                                                padding: '3px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '800',
                                                                backgroundColor: isFinalizado ? '#e6f4ea' : (isEnCurso ? '#fffbeb' : '#f1f5f9'),
                                                                color: isFinalizado ? '#137333' : (isEnCurso ? '#b45309' : '#475569')
                                                            }}>
                                                                {isFinalizado ? 'Finalizado' : (isEnCurso ? 'En Vivo ⚽' : 'Programado')}
                                                            </span>
                                                        </div>

                                                        <div className="match-card-teams" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div className="fixture-team left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', justifyContent: 'flex-start' }}>
                                                                <span className="fixture-flag">{renderFlag(p.bandera_a)}</span>
                                                                <span className="fixture-team-name" style={{ fontWeight: '750', fontSize: '0.9rem', color: 'var(--gray-900)' }}>{p.equipo_a}</span>
                                                            </div>

                                                            <div className="fixture-score-area" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: '60px', padding: '0 5px' }}>
                                                                {isFinalizado || isEnCurso ? (
                                                                    <div className="fixture-score-values" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.04)', padding: '4px 8px', borderRadius: '8px' }}>
                                                                        <span className="score-num" style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--gray-900)' }}>{p.goles_a}</span>
                                                                        <span className="score-dash" style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>-</span>
                                                                        <span className="score-num" style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--gray-900)' }}>{p.goles_b}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="fixture-vs-lbl" style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--gray-400)', background: 'rgba(0,0,0,0.02)', padding: '3px 8px', borderRadius: '6px' }}>VS</span>
                                                                )}
                                                            </div>

                                                            <div className="fixture-team right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', justifyContent: 'flex-end' }}>
                                                                <span className="fixture-team-name" style={{ fontWeight: '750', fontSize: '0.9rem', color: 'var(--gray-900)' }}>{p.equipo_b}</span>
                                                                <span className="fixture-flag">{renderFlag(p.bandera_b)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            });
                        })()}

                        {partidos.length === 0 && (
                            <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '40px 0' }}>
                                No hay partidos mundiales programados en el fixture en este momento.
                            </p>
                        )}
                    </div>
                )}
            </main>

            {/* Zoombable sticker modal */}
            {zoomedSticker && (
                <div className="sobre-revelado-overlay" onClick={() => setZoomedSticker(null)}>
                    <div className="zoomed-sticker-modal animate-scale-in" onClick={e => e.stopPropagation()}>
                        <button className="close-zoom-btn" onClick={() => setZoomedSticker(null)}>✕</button>
                        <div className={`zoomed-sticker-card ${zoomedSticker.rareza}`}>
                            <img src={zoomedSticker.foto_url || "https://i.postimg.cc/XqcCXxZr/buscamos-repartidores-(30).png"} alt={zoomedSticker.nombre} />
                            <div className="zoomed-sticker-footer">
                                <span className="zoomed-num">#{zoomedSticker.numero}</span>
                                <h3 className="zoomed-name">{zoomedSticker.nombre}</h3>
                                <span className={`zoomed-tag ${zoomedSticker.rareza}`}>{zoomedSticker.rareza.toUpperCase()}</span>
                                <span className="zoomed-category">{zoomedSticker.categoria}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Overlay Minijuego Penales */}
            {activeMinigameMision && (
                <div className="sobre-revelado-overlay" style={{ zIndex: 9999 }}>
                    <div className="zoomed-sticker-modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', background: '#0f172a', border: '2px solid #fbbf24', borderRadius: '24px', padding: '24px', color: 'white', textAlign: 'center' }}>
                        <h3 style={{ color: '#fbbf24', margin: '0 0 10px 0', fontSize: '1.4rem' }}>⚽ Penales Mundialistas</h3>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 20px 0' }}>
                            ¡Meté 2 goles o más para ganar{' '}
                            <strong>
                                {activeMinigameMision.puntos_premio > 0 ? `+${activeMinigameMision.puntos_premio} puntos` : ''}
                                {activeMinigameMision.puntos_premio > 0 && activeMinigameMision.sobres_premio > 0 ? ' y ' : ''}
                                {activeMinigameMision.sobres_premio > 0 ? `+${activeMinigameMision.sobres_premio} ${activeMinigameMision.sobres_premio === 1 ? 'sobre' : 'sobres'}` : ''}
                            </strong>!
                        </p>
                        
                        {/* Penalty pitch visualization */}
                        <div style={{ position: 'relative', width: '100%', height: '180px', background: 'linear-gradient(to bottom, #1e3a8a, #15803d)', border: '4px solid white', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px' }}>
                            {/* Goal outline */}
                            <div style={{ position: 'absolute', top: '20px', width: '180px', height: '80px', border: '3px solid white', borderBottom: 'none', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
                                {/* Goalie representation */}
                                <div style={{ 
                                    width: '32px', 
                                    height: '32px', 
                                    borderRadius: '50%', 
                                    background: '#ef4444', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    fontWeight: 'bold', 
                                    fontSize: '0.8rem',
                                    transition: 'all 0.5s',
                                    transform: penaltyState.goalieDir === 'izquierda' ? 'translateX(-60px)' : (penaltyState.goalieDir === 'derecha' ? 'translateX(60px)' : 'none'),
                                    marginBottom: '5px'
                                }}>
                                    🧤
                                </div>
                            </div>

                            {/* Ball representation */}
                            <div style={{ 
                                width: '24px', 
                                height: '24px', 
                                borderRadius: '50%', 
                                background: 'white', 
                                border: '2px solid black', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                transition: 'all 0.5s',
                                transform: penaltyState.status === 'shot_result' || penaltyState.status === 'won' || penaltyState.status === 'lost'
                                    ? (penaltyState.shotDir === 'izquierda' ? 'translateY(-110px) translateX(-50px) scale(0.6)' : (penaltyState.shotDir === 'derecha' ? 'translateY(-110px) translateX(50px) scale(0.6)' : 'translateY(-110px) scale(0.6)'))
                                    : 'none',
                                marginBottom: '20px',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.5)'
                            }}>
                                ⚽
                            </div>
                        </div>

                        {/* Scores and messages */}
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px' }}>
                                <span>Intentos: {penaltyState.attempts} / 3</span>
                                <span style={{ color: '#10b981' }}>Goles: {penaltyState.score} / 2 Necesarios</span>
                            </div>
                            <p style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#f3f4f6', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}>
                                {penaltyState.message}
                            </p>
                        </div>

                        {/* Control buttons */}
                        {penaltyState.status === 'playing' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <button className="btn btn-secondary" onClick={() => handlePenaltyShot('izquierda')} style={{ fontSize: '0.8rem', padding: '10px 0' }}>◀ Izquierda</button>
                                <button className="btn btn-secondary" onClick={() => handlePenaltyShot('centro')} style={{ fontSize: '0.8rem', padding: '10px 0' }}>⏺ Centro</button>
                                <button className="btn btn-secondary" onClick={() => handlePenaltyShot('derecha')} style={{ fontSize: '0.8rem', padding: '10px 0' }}>Derecha ▶</button>
                            </div>
                        )}

                        {/* Restart / Close buttons */}
                        {(penaltyState.status === 'won' || penaltyState.status === 'lost') && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {penaltyState.status === 'lost' && (
                                    <button className="btn btn-primary" onClick={() => startPenaltyGame(activeMinigameMision)} style={{ flex: 1 }}>Volver a Intentar 🔄</button>
                                )}
                                <button className="btn btn-secondary" onClick={() => setActiveMinigameMision(null)} style={{ flex: 1 }}>Cerrar ✕</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Overlay Minijuego Trivia */}
            {triviaMision && (
                <div className="sobre-revelado-overlay" style={{ zIndex: 9999 }}>
                    <div className="zoomed-sticker-modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', background: '#0f172a', border: '2px solid #fbbf24', borderRadius: '24px', padding: '24px', color: 'white', textAlign: 'center' }}>
                        <h3 style={{ color: '#fbbf24', margin: '0 0 10px 0', fontSize: '1.4rem' }}>🧠 Trivia Mundialista</h3>
                        
                        {triviaStatus === 'playing' && (
                            <div>
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 20px 0' }}>
                                    Pregunta {triviaIndex + 1} de {triviaQuestions.length} • Correctas: {triviaScore}
                                </p>
                                
                                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                                    <h4 style={{ margin: 0, fontSize: '1.05rem', lineHeight: '1.4', fontWeight: 'bold' }}>
                                        {triviaQuestions[triviaIndex].question}
                                    </h4>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {triviaQuestions[triviaIndex].options.map((opt, i) => {
                                        let btnBg = '#1e293b';
                                        let btnBorder = '1px solid #334155';
                                        if (showAnswerFeedback) {
                                            if (i === triviaQuestions[triviaIndex].correct) {
                                                btnBg = '#065f46';
                                                btnBorder = '2px solid #34d399';
                                            } else if (i === selectedAnswer) {
                                                btnBg = '#7f1d1d';
                                                btnBorder = '2px solid #f87171';
                                            }
                                        }

                                        return (
                                            <button 
                                                key={i} 
                                                className="btn" 
                                                disabled={showAnswerFeedback}
                                                onClick={() => handleAnswerSelect(i)}
                                                style={{ 
                                                    background: btnBg, 
                                                    border: btnBorder,
                                                    color: 'white',
                                                    padding: '12px 16px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.9rem',
                                                    textAlign: 'left',
                                                    fontWeight: '600',
                                                    cursor: showAnswerFeedback ? 'default' : 'pointer'
                                                }}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Won or Lost Screens */}
                        {(triviaStatus === 'won' || triviaStatus === 'lost') && (
                            <div style={{ padding: '10px 0' }}>
                                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '15px' }}>
                                    {triviaStatus === 'won' ? '🎉' : '😢'}
                                </span>
                                <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 10px 0' }}>
                                    {triviaStatus === 'won' ? '¡FELICITACIONES! ¡CONSEGUISTE LOS PREMIOS!' : '¡MÁS SUERTE LA PRÓXIMA!'}
                                </h4>
                                <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: '1.4' }}>
                                    {triviaStatus === 'won' ? (
                                        `Acertaste ${triviaScore} preguntas correctas de 3. Tus premios (${triviaMision.puntos_premio > 0 ? `+${triviaMision.puntos_premio} puntos` : ''}${triviaMision.puntos_premio > 0 && triviaMision.sobres_premio > 0 ? ' y ' : ''}${triviaMision.sobres_premio > 0 ? `+${triviaMision.sobres_premio} ${triviaMision.sobres_premio === 1 ? 'sobre' : 'sobres'}` : ''}) han sido otorgados.`
                                    ) : (
                                        `Acertaste ${triviaScore} preguntas. Necesitabas al menos 2 correctas para pasar la trivia.`
                                    )}
                                </p>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {triviaStatus === 'lost' && (
                                        <button className="btn btn-primary" onClick={() => startTriviaGame(triviaMision)} style={{ flex: 1 }}>Volver a Intentar 🔄</button>
                                    )}
                                    <button className="btn btn-secondary" onClick={() => setTriviaMision(null)} style={{ flex: 1 }}>Cerrar ✕</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal para añadir atajo PWA / Recordatorios Diarios */}
            {showReminderModal && (
                <div className="sobre-revelado-overlay" onClick={() => setShowReminderModal(false)}>
                    <div className="zoomed-sticker-modal install-guide-modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', background: 'rgba(255, 255, 255, 0.99)', color: 'var(--gray-900)', borderRadius: '24px', border: '3px solid var(--wepi-red)', padding: '24px' }}>
                        <button className="close-zoom-btn" onClick={() => setShowReminderModal(false)} style={{ color: 'var(--gray-700)', border: '1px solid var(--gray-200)', top: '15px', right: '15px' }}>✕</button>
                        
                        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                            <span style={{ fontSize: '2.5rem' }}>📱</span>
                            <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--wepi-red)', margin: '10px 0 5px' }}>
                                Recordatorios Diarios Wepi
                            </h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', margin: 0, lineHeight: '1.4' }}>
                                Agregá un atajo de Wepi a tu pantalla de inicio. ¡Ingresá todos los días con un solo toque y no te pierdas ningún sobre gratis o premio diario!
                            </p>
                        </div>

                        <div className="guide-tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '15px' }}>
                            <div style={{ background: 'rgba(198, 40, 40, 0.04)', border: '1px solid rgba(198, 40, 40, 0.15)', padding: '8px', borderRadius: '12px', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.1rem', display: 'block' }}>🤖</span>
                                <strong style={{ fontSize: '0.75rem', color: 'var(--wepi-red)' }}>Android (Chrome)</strong>
                            </div>
                            <div style={{ background: 'rgba(198, 40, 40, 0.04)', border: '1px solid rgba(198, 40, 40, 0.15)', padding: '8px', borderRadius: '12px', textAlign: 'center' }}>
                                <span style={{ fontSize: '1.1rem', display: 'block' }}>🍏</span>
                                <strong style={{ fontSize: '0.75rem', color: 'var(--wepi-red)' }}>iOS (Safari)</strong>
                            </div>
                        </div>

                        <div className="guide-steps-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', fontSize: '0.8rem', color: 'var(--gray-700)', padding: '0 5px', lineHeight: '1.4' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <span style={{ background: 'var(--wepi-red)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>1</span>
                                <div>
                                    <strong>En Android:</strong> Tocá el menú de tres puntos (<code>⋮</code>) arriba a la derecha en Chrome.
                                    <br />
                                    <strong>En iOS:</strong> Tocá el ícono de compartir (<code>⎋</code> - el cuadrado con la flecha) abajo en Safari.
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <span style={{ background: 'var(--wepi-red)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>2</span>
                                <div>
                                    <strong>En Android:</strong> Elegí la opción <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.
                                    <br />
                                    <strong>En iOS:</strong> Deslizá la lista y elegí <strong>"Añadir a pantalla de inicio"</strong>.
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <span style={{ background: 'var(--wepi-red)', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>3</span>
                                <div>
                                    <strong>¡Listo!</strong> Tendrás el acceso directo en tu pantalla para entrar al instante todos los días. 🚀
                                </div>
                            </div>
                        </div>

                        <button 
                            className="btn btn-primary" 
                            onClick={() => setShowReminderModal(false)}
                            style={{ width: '100%', marginTop: '20px', padding: '12px', background: 'var(--wepi-red-gradient)', border: 'none', color: 'white', fontWeight: 'bold', borderRadius: '12px', cursor: 'pointer' }}
                        >
                            ¡Entendido! 👍
                        </button>
                    </div>
                </div>
            )}

            {/* Premium unified footer matching /pedir theme */}
            <footer className="mundialista-footer">
                <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '80px', objectFit: 'contain' }} />
                <p>© 2026 <strong>Wepi</strong> — Plataforma de Pedidos y Delivery</p>
                <p>
                    <Link to="/locales">Registrá tu local</Link> •{' '}
                    <Link to="/pedir" style={{ color: 'white' }}>Términos</Link> •{' '}
                    <a href="mailto:bajoneando.st@gmail.com">Soporte</a>
                </p>
            </footer>
        </div>
    );
};

export default Mundialista;
