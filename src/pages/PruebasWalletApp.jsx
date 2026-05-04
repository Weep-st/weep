import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useJsApiLoader } from '@react-google-maps/api';
import * as api from '../services/api';
import { iniciarPagoMercadoPago } from '../services/mercadopago';
import { isValidEmail } from '../utils/validation';
import toast from 'react-hot-toast';
import AddressSelector from '../components/AddressSelector';
import HelpChatbot from '../components/HelpChatbot';
import './PruebasWalletApp.css';

export default function PruebasWalletApp() {
  const { slug } = useParams();
  console.log("🚀 PruebasWalletApp: Initialization started");
  // Map Loading
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) {
    console.error("âŒ ERROR: VITE_GOOGLE_MAPS_API_KEY is missing in .env file or build process.");
  }

  const { isLoaded: isMapLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: ['places']
  });

  if (loadError) {
    console.error("âŒ Error loading Google Maps in CustomerApp:", loadError);
  }
  
  const { user, loginAsUser, logoutUser: doLogout, updateUserAddress } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();

  const [locals, setLocals] = React.useState([]);
  const [menus, setMenus] = React.useState([]);
  const [menuTitle, setMenuTitle] = React.useState('');
  const [showMenus, setShowMenus] = React.useState(false);
  const [loadingMenus, setLoadingMenus] = React.useState(false);
  const [favorites, setFavorites] = React.useState([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [filteredLocals, setFilteredLocals] = React.useState(null);
  const [selectedCategory, setSelectedCategory] = React.useState(null);
  const [loadingLocals, setLoadingLocals] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [modal, setModal] = React.useState(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [iceCreamModal, setIceCreamModal] = React.useState(null);
  const [iceCreamFlavors, setIceCreamFlavors] = React.useState([]);
  const [iceCreamSauces, setIceCreamSauces] = React.useState([]);
  const [iceCreamExtras, setIceCreamExtras] = React.useState([]);
  const [selectedSize, setSelectedSize] = React.useState('1/4kg');
  const [selectedFlavors, setSelectedFlavors] = React.useState([]);
  const [selectedSauces, setSelectedSauces] = React.useState([]);
  const [selectedExtras, setSelectedExtras] = React.useState([]);
  const [burgerModal, setBurgerModal] = React.useState(null);
  const [selectedVariant, setSelectedVariant] = React.useState(null);
  const [selectedBurgerExtras, setSelectedBurgerExtras] = React.useState([]);
  const [withFries, setWithFries] = React.useState(false);
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [drinks, setDrinks] = React.useState([]);
  const [hasRepartidores, setHasRepartidores] = React.useState(true);
  const [metodoPago, setMetodoPago] = React.useState('');
  const [hasActiveOrder, setHasActiveOrder] = React.useState(false);
  const [orderCount, setOrderCount] = React.useState(null);
  const [showRegretModal, setShowRegretModal] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [banners, setBanners] = React.useState([]);
  const [bannersLoading, setBannersLoading] = React.useState(true);
  const [promoItems, setPromoItems] = React.useState([]);
  const [loadingPromos, setLoadingPromos] = React.useState(false);

  // Home Optimization States
  const [homeLayout, setHomeLayout] = React.useState({
    dynamicTitle: '',
    dynamicLocales: [],
    promosOfDay: [],
    mostOrdered: [],
    newLocales: [],
    allLocales: [],
    categories: [
      { label: 'Restaurante', type: 'Restaurante', img: 'https://i.postimg.cc/VLtZ23Km/descarga-(1)-(8).jpg' },
      { label: 'Helados', type: 'Heladería', img: 'https://i.postimg.cc/VLPKFCY9/buscamos-repartidores-(18).png' },
      { label: 'Panadería', type: 'Panadería', img: 'https://i.postimg.cc/HnYWFwgm/descarga-(1)-(13).jpg' },
      { label: 'Market', type: 'Market', img: 'https://i.postimg.cc/FFByJ1Gq/buscamos-repartidores-(38).png' },
      { label: 'Farmacia', type: 'Farmacia', img: 'https://i.postimg.cc/vBmn4dnT/buscamos-repartidores-(37).png' }
    ],
    dynamicBanner: '',
    dynamicRubros: [],
    exploreItems: [],
    featuredProLocales: [],
    recommendedPlusLocales: [],
    newFreemiumLocales: []
  });

  // Wallet States
  const [walletBalance, setWalletBalance] = React.useState(null);
  const [useWallet, setUseWallet] = React.useState(false);
  const [walletConfig, setWalletConfig] = React.useState(null);
  const [allWalletConfigs, setAllWalletConfigs] = React.useState({});
  const [loadingConfig, setLoadingConfig] = React.useState(false);
  const [localCommission, setLocalCommission] = React.useState(0.15); // Default 15% (Despegue)
  
  // States for Address Selector
  const [showAddressSelector, setShowAddressSelector] = React.useState(false);
  const [showProfileAddressSelector, setShowProfileAddressSelector] = React.useState(false);
  
  const [addressData, setAddressData] = React.useState({
    address: user?.address || '',
    lat: user?.lat || null,
    lng: user?.lng || null,
    reference: ''
  });

  const [unavailableLocal, setUnavailableLocal] = React.useState(null);
  const [selectedLocal, setSelectedLocal] = React.useState(null);

  // Actualizar addressData cuando el usuario carga (login)
  React.useEffect(() => {
    if (user && !addressData.address) {
      setAddressData(prev => ({
        ...prev,
        address: user.direccion || '',
        lat: user.lat || null,
        lng: user.lng || null
      }));
    }
  }, [user]);

  // Session ID for demand tracking
  const sessionId = React.useMemo(() => {
    let sid = sessionStorage.getItem('wepi_demand_session');
    if (!sid) {
      sid = 'SESS-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      sessionStorage.setItem('wepi_demand_session', sid);
    }
    return sid;
  }, []);

  const searchTimeout = React.useRef(null);
  const [exploreRubroFilter, setExploreRubroFilter] = React.useState('');
  const [exploreCatFilter, setExploreCatFilter] = React.useState('');
  const [discoveryItems, setDiscoveryItems] = React.useState([]);
  const [loadingDiscovery, setLoadingDiscovery] = React.useState(false);

  // States for Searching Driver
  const [searchingDriver, setSearchingDriver] = React.useState(false);
  const [foundDriver, setFoundDriver] = React.useState(null);
  const [driverSearchTimeout, setDriverSearchTimeout] = React.useState(false);
  const [searchSeconds, setSearchSeconds] = React.useState(0);
  const [pendingOrderId, setPendingOrderId] = React.useState(null);
  const [estimatedTime, setEstimatedTime] = React.useState(null);

  const getTimeBasedTitle = React.useCallback(() => {
    const hour = new Date().getHours();
    
    // 00 a 06 hs (antojo nocturno)
    if (hour >= 0 && hour < 6) return { 
        title: "Antojo nocturno... ¿Sale algo?", 
        banner: "https://i.postimg.cc/PxVCPtBd/Gemini-Generated-Image-gf1rg2gf1rg2gf1r.png",
        rubros: ['Restaurante', 'Heladería', 'Market'],
        marketCats: ['Golosinas', 'Snacks', 'Bebidas']
    };
    // 06 a 11 hs (desayuno)
    if (hour >= 6 && hour < 11) return { 
        title: "¡Buenos días! Un rico desayuno", 
        banner: "https://i.postimg.cc/HnhC4bjV/Gemini-Generated-Image-pl34hbpl34hbpl34.png",
        rubros: ['Panadería', 'Market'],
        marketCats: ['Snacks', 'Bebidas']
    };
    // 11 hs a 13 hs (almuerzo)
    if (hour >= 11 && hour < 13) return { 
        title: "Hora del almuerzo: Pedí algo rico", 
        banner: "https://i.postimg.cc/wMPSsHbc/Gemini-Generated-Image-chrryrchrryrchrr.png",
        rubros: ['Restaurante', 'Market'],
        marketCats: ['Bebidas']
    };
    // 13 hs a 16 hs (helado y postre)
    if (hour >= 13 && hour < 16) return { 
        title: "Postres y Tentaciones", 
        banner: "https://i.postimg.cc/9QHk3x3q/Gemini-Generated-Image-fzn3nyfzn3nyfzn3.png",
        rubros: ['Heladería', 'Market'],
        marketCats: ['Golosinas']
    };
    // 16 a 20 hs (merienda)
    if (hour >= 16 && hour < 20) return { 
        title: "Merienda: Un break para vos", 
        banner: "https://i.postimg.cc/JzgG4Bqb/Gemini-Generated-Image-nut1r8nut1r8nut1.png",
        rubros: ['Panadería', 'Heladería', 'Market'],
        marketCats: ['Snacks', 'Bebidas']
    };
    // 20 a 00 hs (cena)
    if (hour >= 20 || hour < 0) return { 
        title: "¿Qué pedimos para cenar?", 
        banner: "https://i.postimg.cc/mZ8ZgHZt/Gemini-Generated-Image-6hv0ff6hv0ff6hv0.png",
        rubros: ['Restaurante', 'Market'],
        marketCats: ['Bebidas']
    };
    
    // Default
    return { 
        title: "¿Qué se te antoja hoy?", 
        banner: "https://i.postimg.cc/mZ8ZgHZt/Gemini-Generated-Image-6hv0ff6hv0ff6hv0.png",
        rubros: ['Restaurante'],
        marketCats: []
    };
  }, []);

  const getBoostedLocales = React.useCallback((locs) => {
    return [...locs].sort((a, b) => {
      // Pro: PLAN-PRO (o similar), Plus: PLAN-PLUS
      const weightA = (a.plan_id?.includes('PRO') ? 3 : (a.plan_id?.includes('PLUS') ? 2 : 1));
      const weightB = (b.plan_id?.includes('PRO') ? 3 : (b.plan_id?.includes('PLUS') ? 2 : 1));
      
      if (weightA !== weightB) return weightB - weightA;
      // Deterministic "performance" (pseudo-random based on id)
      const perfA = (parseInt(a.id?.split('-')[1]) || 0) % 100;
      const perfB = (parseInt(b.id?.split('-')[1]) || 0) % 100;
      return perfB - perfA;
    });
  }, []);

  const getBadgeForLocal = React.useCallback((local, index) => {
    // Máximo 30-40% (1 de cada 3)
    if (index % 3 !== 0) return null;
    
    const isPro = local.plan_id?.includes('PRO');
    const isPlus = local.plan_id?.includes('PLUS');
    
    if (isPro) {
      // Alternar entre Top y Destacado
      return (index % 6 === 0) ? { label: 'Top', type: 'top' } : { label: 'Destacado', type: 'destacado' };
    }
    if (isPlus) {
      return { label: 'Recomendado', type: 'recomendado' };
    }
    return null;
  }, []);
  
  const isClosedToday = React.useCallback((local) => {
    if (!local || !local.modo_automatico) return false;
    const { dias_apertura } = local;
    if (dias_apertura && Array.isArray(dias_apertura) && dias_apertura.length > 0) {
      const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const currentDayName = daysMap[new Date().getDay()];
      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedDays = dias_apertura.map(normalize);
      const normalizedCurrentDay = normalize(currentDayName);
      return !normalizedDays.includes(normalizedCurrentDay);
    }
    return false;
  }, []);

  console.log("🚀 PruebasWalletApp: Logic functions defined");

  const calculateDiscountedPrice = React.useCallback((item) => {
    if (!item) return 0;
    let price = Number(item.precio);
    
    // 1. Item Discount (%) - Takes precedence
    if (item.descuento > 0) {
      price = price * (1 - Number(item.descuento) / 100);
    } else {
      // 2. General Local Discount (Percentage)
      const discountDays = item.local_dias_descuento || item.dias_descuento || [];
      const generalDiscount = Number(item.local_descuento_general || item.descuento_general || 0);
      const categoryDiscount = item.local_categoria_descuento || item.categoria_descuento || '';
      
      if (generalDiscount > 0 && discountDays.length > 0) {
        const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const todayNorm = normalize(today);
        
        const isCorrectDay = discountDays.some(d => normalize(d) === todayNorm);
        const isCorrectCategory = !categoryDiscount || categoryDiscount === item.categoria;

        if (isCorrectDay && isCorrectCategory) {
          price = price * (1 - generalDiscount / 100);
        }
      }
    }
    
    return Math.round(price);
  }, []);

  const renderCreditBadge = React.useCallback((item, isPremium = false) => {
    if (!item) return null;
    const lid = item.local_id;
    const cfg = allWalletConfigs[lid] || allWalletConfigs['global'];
    
    if (!cfg || !cfg.activo || Number(cfg.porcentaje_ganancia) <= 0) return null;
    
    const price = calculateDiscountedPrice(item);
    const minToEarn = Number(cfg.compra_minima_generar || 0);
    
    if (price < minToEarn) return null;
    
    let earned = Math.round(price * (Number(cfg.porcentaje_ganancia) / 100));
    const maxEarn = cfg.tope_maximo_ganancia ? Number(cfg.tope_maximo_ganancia) : null;
    
    if (maxEarn !== null && earned > maxEarn) {
      earned = maxEarn;
    }
    
    if (earned <= 0) return null;
    
    if (isPremium) {
      const isLocalRestricted = cfg.uso_local_exclusivo === true;
      const localName = item.local_nombre || selectedLocal?.nombre || '';
      const locationText = isLocalRestricted ? ` en ${localName}` : '';
      
      return (
        <div className="credit-earn-label animate-fade-in" style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '-2px', marginBottom: '4px' }}>
          Ganás ${earned.toLocaleString()} de credito para tu proxima compra{locationText}
        </div>
      );
    }

    return (
      <div className="credit-earn-label animate-fade-in">
        Ganás ${earned.toLocaleString()}
      </div>
    );
  }, [allWalletConfigs, calculateDiscountedPrice, selectedLocal]);
  
  const doesItemEarnCredit = React.useCallback((item) => {
    if (!item) return false;
    const lid = item.local_id;
    const cfg = allWalletConfigs[lid] || allWalletConfigs['global'];
    if (!cfg || !cfg.activo || Number(cfg.porcentaje_ganancia) <= 0) return false;
    const price = calculateDiscountedPrice(item);
    const minToEarn = Number(cfg.compra_minima_generar || 0);
    return price >= minToEarn;
  }, [allWalletConfigs, calculateDiscountedPrice]);


  const calculateCheckoutTotals = React.useCallback((P, E, method) => {
    const net_commission = P * localCommission;
    const net_local = P - net_commission;
    const total_net = P + E;
    
    let result;
    if (method === 'transferencia') {
      const wepi_income = E + net_commission;
      
      // La comision interna de mp solo debe cubrir la comision de la plataforma
      // Usamos un rate de 10% para cubrir impuestos internos y evitar rupturas
      const MP_SAFE_RATE = 0.10;
      const surcharge = wepi_income * MP_SAFE_RATE / (1 - MP_SAFE_RATE);
      const total_paid = total_net + surcharge;
      
      // Solo a la plataforma debe llegar el neto (incluimos el recargo en la marketplace_fee)
      const marketplace_fee = wepi_income + surcharge;

      result = {
        total: Math.round(total_paid),
        product_total: P,
        delivery_fee: E,
        commission: Math.round(net_commission),
        mp_fee: Math.round(surcharge),
        merchant_payout: Math.round(total_paid - marketplace_fee),
        platform_gross: Math.round(marketplace_fee),
        platform_net: Math.round(wepi_income)
      };
    } else {
      // Default (Efectivo)
      result = {
        total: Math.round(P + E),
        product_total: P,
        delivery_fee: E,
        commission: Math.round(net_commission),
        mp_fee: 0,
        merchant_payout: Math.round(net_local),
        platform_gross: 0,
        platform_net: Math.round(net_commission + E)
      };
    }

    // Validation result for UI
    let walletValidation = { canUse: true, reason: null };

    // Apply Wallet Discount
    if (walletBalance > 0) {
      let maxDiscount = walletBalance;
      
      // Respetar configuración de uso
      if (walletConfig) {
        // Valida compra mínima para uso
        if (P < (walletConfig.compra_minima_uso || 0)) {
           walletValidation = { 
             canUse: false, 
             reason: `Compra mínima de $${walletConfig.compra_minima_uso.toLocaleString()} para usar crédito` 
           };
           maxDiscount = 0;
        } 
        
        // Validar si es acumulable con promociones
        if (walletValidation.canUse && walletConfig.acumulable_promos === false) {
           const hasPromos = cart.items.some(i => {
             const hasDirectDiscount = Number(i.descuento) > 0;
             const generalDiscount = Number(i.local_descuento_general || i.descuento_general || 0);
             const discountDays = i.local_dias_descuento || i.dias_descuento || [];
             const categoryDiscount = i.local_categoria_descuento || i.categoria_descuento || '';
             const today = new Date().toLocaleString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
             const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
             const isCorrectDay = discountDays.some(d => normalize(d) === normalize(today));
             const isCorrectCategory = !categoryDiscount || categoryDiscount === i.categoria;
             const hasGeneralDiscountApplied = generalDiscount > 0 && isCorrectDay && isCorrectCategory;
             const isDiscounted = i.precio_original && Number(i.precio) < Number(i.precio_original);
             return hasDirectDiscount || hasGeneralDiscountApplied || isDiscounted;
           });
           
           if (hasPromos) {
             walletValidation = { 
               canUse: false, 
               reason: "No acumulable con otros descuentos o promociones" 
             };
             maxDiscount = 0;
           }
        }

        if (walletValidation.canUse) {
           // Tope 1: % máximo del saldo disponible
           const percSaldo = walletConfig.porcentaje_maximo_uso_saldo || 100;
           maxDiscount = Math.min(maxDiscount, Math.round(walletBalance * (percSaldo / 100)));

           // Tope 2: % máximo del total del pedido
           const percPedido = walletConfig.max_porcentaje_pedido || 100;
           maxDiscount = Math.min(maxDiscount, Math.round(result.total * (percPedido / 100)));

           // Validar uso mínimo de crédito
           if (maxDiscount < (walletConfig.uso_minimo_credito || 0)) {
             walletValidation = { 
               canUse: false, 
               reason: `Uso mínimo de crédito: $${walletConfig.uso_minimo_credito.toLocaleString()}` 
             };
             maxDiscount = 0;
           }
        }
      }

      if (useWallet && walletValidation.canUse) {
        const discount = Math.min(result.total, maxDiscount);
        result.total -= discount;
        result.walletDiscount = discount;
      }
      
      result.maxAvailableDiscount = maxDiscount;
    }

    result.walletValidation = walletValidation;

    // Potential Credit Calculation respecting walletConfig
    let perc = walletConfig?.porcentaje_ganancia || 0;
    if (useWallet && walletConfig) {
      if (walletConfig.genera_credito_sobre_credito && walletConfig.porcentaje_reducido_recompra) {
        perc = walletConfig.porcentaje_reducido_recompra;
      } else if (!walletConfig.genera_credito_sobre_credito) {
        perc = 0;
      }
    }

    let earned = Math.round(P * (perc / 100));
    if (walletConfig?.tope_maximo_ganancia && earned > walletConfig.tope_maximo_ganancia) {
      earned = walletConfig.tope_maximo_ganancia;
    }
    if (P < (walletConfig?.compra_minima_generar || 0)) {
      earned = 0;
    }

    result.potentialCredit = earned;
    
    return result;
  }, [walletBalance, walletConfig, useWallet, cart.items]);

  const isLocalOpen = React.useCallback((local) => {
    if (!local) return false;

    // Verificar si ya pasó la fecha de disponibilidad
    if (local.disponible_desde) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = local.disponible_desde.split('-');
      const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (today < availableDate) return false;
    }
    
    // Si no tiene modo automático, dependemos del estado manual
    if (!local.modo_automatico) {
      return local.estado?.toLowerCase() === 'activo';
    }

    // Si tiene modo automático, verificamos horario y días
    const { horario_apertura, horario_cierre, dias_apertura } = local;
    if (!horario_apertura || !horario_cierre) return local.estado?.toLowerCase() === 'activo';

    // Verificar días
    if (dias_apertura && Array.isArray(dias_apertura) && dias_apertura.length > 0) {
      const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const currentDayName = daysMap[new Date().getDay()];
      const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normalizedDays = dias_apertura.map(normalize);
      const normalizedCurrentDay = normalize(currentDayName);
      if (!normalizedDays.includes(normalizedCurrentDay)) return false;
    }

    // Verificar horario (Turno 1)
    const [hA, mA] = horario_apertura.split(':').map(Number);
    const [hC, mC] = horario_cierre.split(':').map(Number);
    const minApertura = hA * 60 + mA;
    const minCierre = hC * 60 + mC;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    let insideTime = false;
    if (minApertura < minCierre) {
      insideTime = current >= minApertura && current <= minCierre;
    } else {
      insideTime = current >= minApertura || current <= minCierre;
    }

    // Verificar horario (Turno 2) si no está abierto en el primero
    if (!insideTime && local.horario_apertura2 && local.horario_cierre2) {
      const [hA2, mA2] = local.horario_apertura2.split(':').map(Number);
      const [hC2, mC2] = local.horario_cierre2.split(':').map(Number);
      const minApertura2 = hA2 * 60 + mA2;
      const minCierre2 = hC2 * 60 + mC2;

      if (minApertura2 < minCierre2) {
        insideTime = current >= minApertura2 && current <= minCierre2;
      } else {
        insideTime = current >= minApertura2 || current <= minCierre2;
      }
    }

    return insideTime;
  }, []);

  const getLocalStatusText = React.useCallback((local) => {
    if (!local) return '';
    if (local.nombre?.toUpperCase() === 'FULL') return 'Próximamente';
    const isOpen = isLocalOpen(local);
    
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();

    if (!isOpen) {
      // Determinar cuál es el próximo horario de apertura
      let nextApertura = local.horario_apertura;
      if (local.horario_apertura2 && local.horario_apertura) {
        const [hA, mA] = local.horario_apertura.split(':').map(Number);
        const minApertura = hA * 60 + mA;
        const [hA2, mA2] = local.horario_apertura2.split(':').map(Number);
        const minApertura2 = hA2 * 60 + mA2;

        // Si ya pasó el primer turno o estamos más cerca del segundo
        if (current > minApertura && current < minApertura2) {
          nextApertura = local.horario_apertura2;
        }
      }
      
      if (nextApertura) return `abre ${nextApertura}`;
      return 'Cerrado';
    }

    // Si está abierto, determinar cuál es el próximo horario de cierre
    let nextCierre = local.horario_cierre;
    if (local.horario_apertura2 && local.horario_cierre2) {
      const [hA2, mA2] = local.horario_apertura2.split(':').map(Number);
      const minApertura2 = hA2 * 60 + mA2;
      const [hC2, mC2] = local.horario_cierre2.split(':').map(Number);
      const minCierre2 = hC2 * 60 + mC2;

      // Si estamos en el rango del segundo turno
      if (current >= minApertura2 || (minApertura2 > minCierre2 && current <= minCierre2)) {
        nextCierre = local.horario_cierre2;
      }
    }

    if (nextCierre) return `cierra ${nextCierre}`;
    return 'Abierto';
  }, [isLocalOpen]);
  // Load locals + drinks on mount
  React.useEffect(() => {
    console.log("🚀 PruebasWalletApp: Main data useEffect running");
    // Tracking: Page View
    api.trackDemandSignal('page_view', sessionId).catch(() => {});

    Promise.all([
      api.getLocales(),
      api.getBebidas(),
      api.getBanners(),
      api.getPromos(),
      api.getMostOrderedItems(),
      api.getExploreItems(),
      api.getAllWalletConfigs()
    ]).then(([locs, deks, bans, prms, most, expl, wcfgs]) => {
      const allLocs = locs || [];
      const boosted = getBoostedLocales(allLocs);
      
      const timeInfo = getTimeBasedTitle();
      
      // Map wallet configs by local_id
      const configMap = {};
      if (Array.isArray(wcfgs)) {
        wcfgs.forEach(c => {
          if (c.local_id) configMap[c.local_id] = c;
          else configMap['global'] = c;
        });
      }
      setAllWalletConfigs(configMap);

      setLocals(allLocs);
      setDrinks(deks || []);
      setBanners(bans || []);
      console.log("🚀 PruebasWalletApp: Data fetched successfully", { locs: !!locs, prms: !!prms });
      setPromoItems(prms || []);
      setBannersLoading(false);
      setLoadingPromos(false);

      // Setup Home Layout
      setHomeLayout(prev => {
        const PLAN_PRO = '87bdad7f-51cf-4c9c-ae64-ebab8b07b105';
        const PLAN_PLUS = 'ab9be1bd-f535-476e-90f4-f03ba074ba7d';
        const PLAN_FREEMIUM = 'b404e2f7-6716-499b-8ebf-200ce417e4cb';

        const proFound = boosted.filter(l => l.plan_id === PLAN_PRO).sort((a, b) => (isLocalOpen(b) ? 1 : 0) - (isLocalOpen(a) ? 1 : 0));
        const plusFound = boosted.filter(l => l.plan_id === PLAN_PLUS).sort((a, b) => (isLocalOpen(b) ? 1 : 0) - (isLocalOpen(a) ? 1 : 0));
        const freeFound = boosted.filter(l => l.plan_id === PLAN_FREEMIUM).sort((a, b) => (isLocalOpen(b) ? 1 : 0) - (isLocalOpen(a) ? 1 : 0));

        return {
          ...prev,
          dynamicTitle: timeInfo.title,
          dynamicBanner: timeInfo.banner,
          dynamicRubros: timeInfo.rubros,
          allLocales: boosted,
          dynamicLocales: boosted.filter(l => timeInfo.rubros.some(r => l.rubros?.includes(r) || l.rubro === r)).slice(0, 15),
          promosOfDay: (prms || []).filter(p => {
            const l = allLocs.find(loc => loc.id === p.local_id);
            if (!l || !isLocalOpen(l)) return false;

            const cfg = configMap[p.local_id] || configMap['global'];
            const earnsCredit = cfg && cfg.activo && Number(cfg.porcentaje_ganancia) > 0 && calculateDiscountedPrice(p) >= Number(cfg.compra_minima_generar || 0);

            const hasBaseDiscount = p.descuento > 0;
            const isSpecialCategory = p.categoria === 'Combos' || p.categoria === 'Promos';
            const hasDayDiscount = calculateDiscountedPrice(p) < Number(p.precio);
            return hasBaseDiscount || isSpecialCategory || hasDayDiscount || earnsCredit;
          }).sort((a, b) => {
            const locA = allLocs.find(l => l.id === a.local_id);
            const locB = allLocs.find(l => l.id === b.local_id);
            const openA = isLocalOpen(locA) ? 1 : 0;
            const openB = isLocalOpen(locB) ? 1 : 0;
            
            if (openA !== openB) return openB - openA;

            const discA = Number(a.precio) - calculateDiscountedPrice(a);
            const discB = Number(b.precio) - calculateDiscountedPrice(b);
            return discB - discA;
          }).slice(0, 30),
          mostOrdered: (most || boosted.slice(0, 12)).sort((a, b) => {
            const locA = allLocs.find(l => l.id === a.local_id);
            const locB = allLocs.find(l => l.id === b.local_id);
            const openA = isLocalOpen(locA) ? 1 : 0;
            const openB = isLocalOpen(locB) ? 1 : 0;
            return openB - openA;
          }),
          newLocales: [...allLocs].filter(l => l.admin_status === 'Aceptado').sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10),
          exploreItems: expl || [],
          featuredProLocales: proFound,
          recommendedPlusLocales: plusFound,
          newFreemiumLocales: freeFound.slice(0, 12)
        };
      });
    }).catch(console.error);

    // Verificar repartidores al cargar
    api.checkActiveRepartidores().then(r => setHasRepartidores(r.hasActive)).catch(() => {});
    if (user) {
      api.getFavoritos(user.id).then(d => {
        if (Array.isArray(d)) setFavorites(d);
      }).catch(() => {});
      
      api.getMisPedidos(user.id).then(res => {
        setHasActiveOrder(!!(res.enCurso && res.enCurso.length > 0));
      }).catch(() => {});

      // Order Count
      api.getUserOrderCount(user.id).then(setOrderCount).catch(() => {});
    } else {
      setOrderCount(null);
      setWalletBalance(0);
    }
  }, [user, sessionId, getBoostedLocales, getTimeBasedTitle]);

  
  // Fetch Wallet Config and applicable Balance when local changes
  React.useEffect(() => {
    const localId = selectedLocal?.id || (cart.items.length > 0 ? cart.items[0].local_id : null);
    
    // Reset config when local changes to avoid stale data
    setWalletConfig(null);

    if (localId && user?.id) {
      setLoadingConfig(true);
      api.getWalletConfigForLocal(localId)
        .then(setWalletConfig)
        .catch(console.error)
        .finally(() => setLoadingConfig(false));
      
      // Update balance respecting potential local restriction
      api.getUserWalletBalance(user.id, localId)
        .then(setWalletBalance)
        .catch(console.error);

      // Fetch dynamic commission for the local
      api.getPlanInfo(localId)
        .then(res => {
          if (res.success && res.comision_actual) {
            console.log(`📊 PruebasWalletApp: Comisión para local ${localId}: ${res.comision_actual}%`);
            setLocalCommission(res.comision_actual / 100);
          } else {
            setLocalCommission(0.15); // Fallback to 15%
          }
        })
        .catch(() => setLocalCommission(0.15));
    } else {
      setWalletConfig(null);
      setLocalCommission(0.15);
      if (user?.id) {
        api.getUserWalletBalance(user.id).then(setWalletBalance).catch(console.error);
      }
    }
  }, [selectedLocal, cart.items, user?.id]);

  // Forzar cambio a retiro si no hay repartidores y está seleccionado envio
  React.useEffect(() => {
    if (hasRepartidores === false && cart.deliveryType === 'envio') {
      // Intentar obtener el local del primer item del carrito si selectedLocal es null
      const localRef = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);
      const puedeRetirar = localRef?.acepta_retiro === true;
      if (puedeRetirar) {
        cart.setDeliveryType('retiro');
      }
    }
  }, [hasRepartidores, cart.deliveryType, selectedLocal, cart, locals]);

  // MP Return URL Parse
  React.useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const status = query.get('status');
    const payment_id = query.get('payment_id');
    const preference_id = query.get('preference_id');

    if (status && payment_id) {
      const pendingRaw = localStorage.getItem('pendingOrderData');
      if (pendingRaw) {
        try {
          const pendingData = JSON.parse(pendingRaw);
          if (status === 'approved') {
            toast.success(`¡Pago confirmado! Tu pedido #${pendingData.pedidoId} está siendo procesado.`);
            
            // Actualizar estado del pedido en la base de datos
            api.markOrderAsPaid(
              pendingData.pedidoId, 
              payment_id, 
              preference_id, 
              pendingData.externalReference
            ).then(async (res) => {
              if (res.success) {
                // Si el pedido tiene un repartidor asignado, notificarlo
                try {
                  const orderRes = await api.getOrderDetail(user.id, pendingData.pedidoId);
                  if (orderRes.success && orderRes.detalle.repartidor_id) {
                    await api.notifyDriverAboutPaymentApproved(
                      pendingData.pedidoId, 
                      orderRes.detalle.repartidor_id
                    );
                  }
                } catch (err) {
                  console.error("Error al notificar al repartidor:", err);
                }
              }
            }).catch(e => console.error("Error al marcar pedido como pagado:", e));
            
            // Facebook Pixel: Purchase
            if (window.fbq) {
              window.fbq('track', 'Purchase', {
                value: pendingData.total,
                currency: 'ARS',
                content_ids: [pendingData.pedidoId],
                content_type: 'product_group'
              });
            }

            // Google Analytics: purchase
            if (window.gtag) {
              window.gtag('event', 'purchase', {
                transaction_id: pendingData.pedidoId,
                value: pendingData.total,
                currency: 'ARS',
                items: pendingData.cart.map(i => ({
                  item_id: i.id,
                  item_name: i.nombre,
                  quantity: i.qty,
                  price: i.price || i.precio
                }))
              });
            }

            // Notificar a los locales sobre el nuevo pedido pagado
            api.notifyLocalsAboutNewOrder(
              pendingData.pedidoId, pendingData.cart,
              pendingData.direccion, pendingData.tipoEntrega,
              pendingData.observaciones, pendingData.metodoPago
            ).catch(e => console.error("Error notificando locales (MP Success):", e));

            cart.clearCart();
          } else if (status === 'pending') {
            toast.error('El pago está pendiente de aprobación');
          } else {
            toast.error('El pago no fue aprobado');
          }
        } catch(e) { console.error('Error parsing pending order data', e); }
        finally {
          localStorage.removeItem('pendingOrderData');
        }
      }
      
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [cart]);

  // Refrescar repartidores cada vez que el carrito se abre
  React.useEffect(() => {
    if (cartOpen) {
      api.checkActiveRepartidores().then(r => setHasRepartidores(r.hasActive)).catch(() => {});
    }
  }, [cartOpen]);

  // Search
  React.useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (search.length >= 3) {
      searchTimeout.current = setTimeout(() => {
        setLoadingMenus(true);
        api.buscarMenu(search).then(d => {
          setMenus(d || []);
          setMenuTitle(`Resultados para "${search}"`);
          setShowMenus(true);
        }).catch(() => toast.error('Error en búsqueda')).finally(() => setLoadingMenus(false));
      }, 500);
    } else if (search === '') {
      setShowMenus(false);
    }
  }, [search]);

  const fetchMenusByLocal = React.useCallback((localId, catId = null) => {
    setLoadingMenus(true);
    const local = (filteredLocals || locals).find(l => l.id === localId) || locals.find(l => l.id === localId);
    setSelectedLocal(local);

    // Tracking: Local View
    api.trackDemandSignal('local_view', sessionId).catch(() => {});
    
    // Auto-select delivery type if only one is available
    if (local) {
      if (local.acepta_envio === false && cart.deliveryType === 'envio') {
        if (local.acepta_retiro === true) cart.setDeliveryType('retiro');
      } else if (local.acepta_retiro !== true && cart.deliveryType === 'retiro') {
        if (local.acepta_envio !== false) cart.setDeliveryType('envio');
      }
    }

    api.getMenuByLocalId(localId).then(d => {
      let mapped = (d || [])
        .filter(i => i.disponibilidad !== false)
        .map(i => ({
          ...i, 
          local_nombre: local?.nombre || 'Local', 
          local_logo: local?.logo || '',
          local_disponible_desde: local?.disponible_desde || null,
        }));
      if (catId) {
        mapped = mapped.filter(i => (i.categoria || '').toLowerCase() === catId.toLowerCase());
      }
      setMenus(mapped);
      setMenuTitle(catId ? `${catId} en ${local?.nombre || 'Local'}` : `Menú de ${local?.nombre || 'Local'}`);
      setShowMenus(true);
    }).catch(() => toast.error('No pudimos cargar el menú')).finally(() => setLoadingMenus(false));
  }, [locals, filteredLocals]);

  // Carga automática por slug (Landing Page de Local)
  React.useEffect(() => {
    if (slug) {
      console.log("🔗 PruebasWalletApp: Slug detectado en URL:", slug);
      api.getLocalBySlug(slug).then(local => {
        if (local && local.admin_status === 'Aceptado') {
          console.log("✅ PruebasWalletApp: Local encontrado y aceptado:", local.nombre);
          fetchMenusByLocal(local.id);
        } else if (local && local.admin_status !== 'Aceptado') {
          console.warn("⚠️ PruebasWalletApp: Local no aceptado:", local.nombre);
          toast.error("Este local aún no está habilitado.");
          navigate('/pruebas');
        } else {
          console.warn("⚠️ PruebasWalletApp: Local no encontrado para el slug:", slug);
          toast.error("El local solicitado no existe.");
          navigate('/pruebas');
        }
      }).catch(err => {
        console.error("❌ PruebasWalletApp: Error cargando local por slug:", err);
        toast.error("Error al cargar el menú del local.");
      });
    } else {
      setShowMenus(false);
      setSelectedLocal(null);
    }
  }, [slug, navigate, fetchMenusByLocal]);

  const handleBannerClick = React.useCallback(async () => {
    const info = getTimeBasedTitle();
    if (!info.rubros || info.rubros.length === 0) return;

    setLoadingLocals(true);
    setLoadingDiscovery(true);
    setDiscoveryItems([]);
    setExploreRubroFilter('');
    setExploreCatFilter('');

    try {
      // 1. Fetch locales for all rubros in parallel
      const rubroPromises = info.rubros.map(r => api.getLocalesByRubro(r).catch(() => []));
      const results = await Promise.all(rubroPromises);
      
      const allLocales = results.flat().map(l => ({
        id: l.local_id, 
        nombre: l.nombre_local, 
        logo: l.logo_url,
        estado: l.estado, 
        precio_min: l.precio_min_categoria || 0,
        horario_apertura: l.horario_apertura, 
        horario_cierre: l.horario_cierre,
        modo_automatico: l.modo_automatico, 
        dias_apertura: l.dias_apertura,
        disponible_desde: l.disponible_desde, 
        rubro: l.rubro_local || l.rubro
      }));

      // Filter open ones
      const openLocales = allLocales.filter(l => isLocalOpen(l));
      
      // Remove duplicates
      const uniqueOpen = [];
      const seen = new Set();
      openLocales.forEach(l => {
        if (!seen.has(l.id)) {
          uniqueOpen.push(l);
          seen.add(l.id);
        }
      });

      setFilteredLocals(uniqueOpen);
      setSelectedCategory(info.title);

      // 2. Fetch menu items for discovery (Market cats + top from locales)
      const allItems = await api.getMenuCompleto();
      const filteredItems = (allItems || []).filter(item => {
        const matchesMarket = info.marketCats?.includes(item.categoria);
        const matchesRubro = info.rubros?.includes(item.local_rubro);
        return (matchesMarket || matchesRubro) && item.disponibilidad;
      });
      
      // Only keep items from open locales
      const finalDiscovery = filteredItems.filter(item => {
        const local = allLocales.find(l => l.id === item.local_id);
        return local && isLocalOpen(local);
      }).slice(0, 30);

      setDiscoveryItems(finalDiscovery);
      setShowMenus(false); 
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar recomendaciones');
    } finally {
      setLoadingLocals(false);
      setLoadingDiscovery(false);
    }
  }, [getTimeBasedTitle, isLocalOpen]);

  const fetchByCategory = React.useCallback((cat) => {
    setDiscoveryItems([]); // Clear discovery when entering specific category
    api.trackDemandSignal('category_view', sessionId).catch(() => {});
    if (cat === 'favoritos') {
      if (!user) { setModal('login'); return; }
      setLoadingMenus(true);
      api.getMenuCompleto().then(all => {
        const favMenus = all.filter(m => favorites.includes(m.id));
        setMenus(favMenus);
        setMenuTitle('Mis Favoritos');
        setShowMenus(true);
      }).catch(() => toast.error('Error al cargar favoritos')).finally(() => setLoadingMenus(false));
      return;
    }
    
    setLoadingLocals(true);
    api.getLocalesByRubro(cat).then(d => {
      const mapped = (d || []).map(l => ({
        id: l.local_id,
        nombre: l.nombre_local,
        logo: l.logo_url,
        estado: l.estado,
        precio_min: l.precio_min_categoria || 0,
        horario_apertura: l.horario_apertura,
        horario_cierre: l.horario_cierre,
        modo_automatico: l.modo_automatico,
        dias_apertura: l.dias_apertura,
        disponible_desde: l.disponible_desde
      })).sort((a, b) => (isLocalOpen(b) ? 1 : 0) - (isLocalOpen(a) ? 1 : 0));
      setFilteredLocals(mapped);
      setSelectedCategory(cat);
      setShowMenus(false);
      setTimeout(() => {
        document.querySelector('.locals-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }).catch(() => toast.error('Error al cargar locales')).finally(() => setLoadingLocals(false));
  }, [user, favorites]);

  const toggleFav = React.useCallback(async (menuId) => {
    if (!user) { setModal('login'); return; }
    try {
      const r = await api.toggleFavorito(user.id, menuId);
      if (r.added) {
        setFavorites(prev => [...prev, menuId]);
        toast.success('â™¥ Agregado a favoritos');
      } else {
        setFavorites(prev => prev.filter(id => id !== menuId));
        toast.success('Quitado de favoritos');
      }
    } catch { toast.error('Error'); }
  }, [user, favorites]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setAuthLoading(true);
    try {
      const d = await api.loginUsuario(fd.get('email').toLowerCase(), fd.get('password'));
      if (d.success) {
        loginAsUser({ 
          userId: d.userId, 
          name: d.nombre, 
          email: d.email || fd.get('email'), 
          address: d.direccion, 
          telefono: d.telefono, 
          emailConfirmado: d.emailConfirmado 
        });
        setModal(null);
        toast.success('¡Bienvenido!');
      } else toast.error('Credenciales incorrectas');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!user?.email) return;
    const loading = toast.loading('Reenviando email...');
    try {
      const res = await api.reenviarEmailConfirmacion(user.email, 'usuario');
      if (res.success) toast.success('¡Email reenviado! Revisa tu bandeja de entrada.', { id: loading });
      else toast.error(res.error || 'Error al reenviar', { id: loading });
    } catch { toast.error('Error de conexión', { id: loading }); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email').toLowerCase();
    const nombre = fd.get('nombre');
    const password = fd.get('password');
    const direccion = fd.get('direccion');
    const prefix = fd.get('prefix');
    const localNumber = fd.get('telefono');
    const telefono = `${prefix}${localNumber}`;

    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }
    if (!localNumber) { toast.error('El teléfono es obligatorio'); return; }
    
    setAuthLoading(true);
    try {
      const d = await api.registerUsuario(
        nombre, email, password, direccion, telefono,
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted'),
        fd.get('terms_accepted') === 'on' || !!fd.get('terms_accepted')
      );
      if (d.success) {
        loginAsUser({ 
          userId: d.userId, 
          name: nombre, 
          email: email, 
          address: direccion,
          telefono: telefono
        });
        setModal(null);
        toast.success('¡Registro exitoso!');
      } else toast.error('Error al registrar');
    } catch { toast.error('Error de conexión'); }
    setAuthLoading(false);
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const nombre = fd.get('nombre');
    const email = fd.get('email');
    const prefix = fd.get('prefix');
    const localNumber = fd.get('telefono');
    const telefono = `${prefix}${localNumber}`;
    const newPass = fd.get('newPassword');

    if (!nombre || !email || !localNumber) { toast.error('Nombre, email y teléfono son obligatorios'); return; }
    if (!isValidEmail(email)) { toast.error('Ingresá un email válido'); return; }
    if (newPass && newPass.length < 6) { toast.error('La nueva contraseña debe tener 6+ caracteres'); return; }
    
    setAuthLoading(true);
    try {
      await api.updateProfile(user.id, nombre, email, telefono, newPass || null);
      // Update local state
      loginAsUser({ userId: user.id, name: nombre, email, address: user.address, telefono });
      toast.success('Perfil actualizado');
      setModal('profile');
    } catch { toast.error('Error al actualizar perfil'); }
    setAuthLoading(false);
  };

  const checkoutTotals = React.useMemo(() => {
    return calculateCheckoutTotals(cart.subtotal, cart.shippingCost, metodoPago);
  }, [calculateCheckoutTotals, cart.subtotal, cart.shippingCost, metodoPago]);

  const totalConComision = checkoutTotals.total;
  const visibleMpFee = checkoutTotals.mp_fee;
  
  // Usar configuración dinámica para la vista previa de crédito
  const potentialCredit = React.useMemo(() => {
    if (!walletConfig) return 0;
    
    // Validar compra mínima para generar
    if (cart.subtotal < (walletConfig.compra_minima_generar || 0)) return 0;
    
    // Determinar porcentaje (Normal vs Reducido por recompra) solo si ya se implementó genera_credito_sobre_credito
    let perc = walletConfig.porcentaje_ganancia || 0;
    if (useWallet && walletConfig.genera_credito_sobre_credito && walletConfig.porcentaje_reducido_recompra) {
        perc = walletConfig.porcentaje_reducido_recompra;
    } else if (useWallet && !walletConfig.genera_credito_sobre_credito) {
        return 0; // No genera si usa crédito
    }

    let earned = Math.round(cart.subtotal * (perc / 100));
    if (walletConfig.tope_maximo_ganancia && earned > walletConfig.tope_maximo_ganancia) {
        earned = walletConfig.tope_maximo_ganancia;
    }
    return earned;
  }, [cart.subtotal, walletConfig, useWallet]);

  const walletDiscountUI = checkoutTotals.walletDiscount || 0;
  const visibleShipping = cart.deliveryType === 'envio' ? cart.shippingCost : 0;



  const handleAddToCart = async (menu) => {
    // Red de seguridad: Verificar disponibilidad antes de cualquier acción
    const availabilityDate = menu.local_disponible_desde;
    if (availabilityDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = availabilityDate.split('-');
      const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (today < availableDate) {
        toast.error(`Este local abrirá el ${availableDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })}`);
        return;
      }
    }

    // Verificar si el local está abierto
    const localRef = selectedLocal || locals.find(l => l.id === menu.local_id) || menu;
    if (!isLocalOpen(localRef)) {
      if (localRef.nombre?.toUpperCase() === 'FULL') {
        toast.error('Este local estará disponible próximamente');
      } else {
        toast.error('Este local está cerrado por el momento');
      }
      return;
    }

    // Detect category and configuration
    let cfg = null;
    try {
      if (typeof menu.variantes === 'string') cfg = JSON.parse(menu.variantes);
      else if (typeof menu.variantes === 'object') cfg = menu.variantes;
    } catch (e) {}

    const isIceCream = cfg?.es_helado;
    const isBurgerOrCombo = cfg?.es_hamburguesa || cfg?.es_combo || cfg?.es_pancho || cfg?.con_papas;

    if (isIceCream) {
      setSelectedSize('1/4kg');
      setSelectedFlavors([]);
      setSelectedSauces([]);
      setSelectedExtras([]);
      try {
        const [flavors, extras] = await Promise.all([
          api.getSaboresByLocal(menu.local_id),
          api.getAdicionalesByLocal(menu.local_id)
        ]);
        
        const filteredFlavors = flavors.filter(f => f.disponible && (f.tipo === 'Sabor' || f.tipo === 'sabor'));
        const filteredSauces = flavors.filter(f => f.disponible && (f.tipo === 'Salsa' || f.tipo === 'salsa'));
        
        setIceCreamFlavors(filteredFlavors);
        setIceCreamSauces(filteredSauces);
        setIceCreamExtras(extras.filter(e => e.disponible));
        
        setIceCreamModal({
          ...menu,
          salsasDisponibles: filteredSauces
        });
        return; 
      } catch {
        toast.error('Error al cargar opciones de helado');
      }
    }

    if (isBurgerOrCombo) {
      setBurgerModal(menu);
      setSelectedVariant(cfg.variants?.[0] || null);
      setSelectedBurgerExtras([]);
      setWithFries(false);
      return; 
    }

    // Facebook Pixel: AddToCart
    if (window.fbq) {
      window.fbq('track', 'AddToCart', {
        content_name: menu.nombre,
        content_ids: [menu.id],
        content_type: 'product',
        value: menu.precio,
        currency: 'ARS'
      });
    }

    // Google Analytics: add_to_cart
    if (window.gtag) {
      window.gtag('event', 'add_to_cart', {
        currency: 'ARS',
        value: menu.precio,
        items: [{
          item_id: menu.id,
          item_name: menu.nombre,
          price: menu.precio,
          quantity: 1
        }]
      });
    }

    // Tracking: Add to Cart
    api.trackDemandSignal('add_to_cart', sessionId).catch(() => {});

    // Calculate final price once here
    const discountedPrice = calculateDiscountedPrice(menu);
    console.log("🛒 handleAddToCart: Price calculation", { 
      name: menu.nombre, 
      original: menu.precio, 
      final: discountedPrice 
    });
    
    const itemToAdd = {
      ...menu,
      precio: discountedPrice,
      precioOriginal: menu.precioOriginal || menu.precio
    };

    // Default addition for other items
    cart.addItem(itemToAdd);
    toast((t) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        ¡{menu.nombre} agregado! ✓
        <button onClick={() => { openCart(); toast.dismiss(t.id); }} style={{ background: 'var(--red-500)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
          Ver carrito
        </button>
      </span>
    ), { duration: 3000, style: { padding: '12px 16px' } });
  };

  const renderMenuItem = React.useCallback((item) => {
    const itemCfg = typeof item.variantes === 'string' ? JSON.parse(item.variantes || '{}') : (item.variantes || {});
    const needsCustomization = itemCfg.es_helado || itemCfg.es_hamburguesa || itemCfg.es_combo || itemCfg.con_papas;
    
    return (
      <div 
        key={item.id} 
        className="menu-card card card-hover" 
        style={{ cursor: 'pointer' }}
        onClick={() => handleAddToCart(item)}
      >
        <div className="menu-card-img-container">
          <img src={item.imagen_url || 'https://placehold.co/120x120?text=Sin+Imagen'} alt={item.nombre} className="menu-card-img" />
          {(() => {
            const discountedPrice = calculateDiscountedPrice(item);
            if (discountedPrice < Number(item.precio)) {
              const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
              return <div className="menu-discount-badge">{percent}% OFF</div>;
            }
            return null;
          })()}
          </div>
        <div className="menu-card-body">
          <div className="menu-card-local" style={{ marginBottom: '2px' }}>
             <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)' }}>{item.categoria}</span>
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>{item.nombre}</h3>
          {renderCreditBadge(item, true)}
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '8px', lineHeight: '1.2' }}>{item.descripcion}</p>
          <div className="menu-card-footer">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="menu-card-price">${calculateDiscountedPrice(item).toLocaleString()}</span>
              {calculateDiscountedPrice(item) < Number(item.precio) && (
                <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                  ${Number(item.precio).toLocaleString()}
                </span>
              )}
            </div>
            <div className="menu-card-actions">
              {isLocalOpen(selectedLocal) ? (
                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>
                  {needsCustomization ? 'Elegir' : 'Agregar'}
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--red-600)', fontWeight: 'bold' }}>
                  {selectedLocal?.nombre?.toUpperCase() === 'FULL' ? 'PRÓXIMAMENTE' : 'CERRADO'}
                </span>
              )}
              <button 
                 className={`fav-btn ${favorites.includes(item.id) ? 'active' : ''}`}
                 onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }}
              >
                 <img 
                   src={favorites.includes(item.id) ? "https://i.postimg.cc/BZYZmSz1/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find.png" : "https://i.postimg.cc/W4Gb8MRV/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find(1).png"} 
                   style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                   alt="Favorito" 
                 />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }, [calculateDiscountedPrice, handleAddToCart, renderCreditBadge, selectedLocal, isLocalOpen, favorites, toggleFav]);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) { setModal('login'); return; }
    if (cart.items.length === 0) { toast.error('Tu carrito está vacío'); return; }
    const fd = new FormData(e.target);
    const mp = metodoPago; // Use state instead of FormData
    const dir = addressData.address;
    if (cart.deliveryType === 'envio' && !dir) { toast.error('Ingresá tu dirección de entrega'); return; }

    // Validación de dirección correcta (no solo el nombre de la ciudad)
    if (cart.deliveryType === 'envio') {
      const lowerAddr = dir.toLowerCase();
      const cityStrings = [
        'santo tomé, corrientes', 
        'santo tomé', 
        'santo tome, corrientes', 
        'santo tome',
        'santo tomé, corrientes province',
        'santo tome, corrientes province',
        'santo tomé, provincia de corrientes',
        'santo tome, provincia de corrientes'
      ];
      const isJustCity = cityStrings.some(s => lowerAddr.startsWith(s)) && lowerAddr.length < 60;

      if (isJustCity) {
        toast.error('Dirección no encontrada, por favor indica tu dirección con el marcador');
        setShowAddressSelector(true);
        return;
      }
    }

    if (!mp) { toast.error('Seleccioná un método de pago'); return; }
    
    // Facebook Pixel: InitiateCheckout
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout');
    }

    // Google Analytics: begin_checkout
    if (window.gtag) {
      window.gtag('event', 'begin_checkout', {
        currency: 'ARS',
        value: cart.subtotal,
        items: cart.items.map(i => ({
          item_id: i.id,
          item_name: i.nombre,
          price: i.precio,
          quantity: i.qty
        }))
      });
    }

    const currentLocal = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);

    // Check repartidores active strictly before proceeding if envio is selected
    if (cart.deliveryType === 'envio') {
      const freshRiders = await api.checkActiveRepartidores();
      if (!freshRiders.hasActive) {
        setHasRepartidores(false);
        const puedeRetirar = currentLocal?.acepta_retiro === true;
        if (puedeRetirar) {
          cart.setDeliveryType('retiro');
        }
        return;
      }
    }

    if (cart.deliveryType === 'retiro' && currentLocal?.acepta_retiro !== true) {
      toast.error('Este local no ofrece la opción de retiro en el local.');
      return;
    }

    // Validación de primer pedido por transferencia
    if (mp === 'efectivo' && (orderCount === 0 || orderCount === null)) {
      // Si es null, por seguridad asumimos que es el primero si ya logramos obtener user e intentamos cargar orderCount
      toast.error('Por seguridad, tu primer pedido debe ser por transferencia / Mercado Pago.');
      setMetodoPago('transferencia');
      return;
    }

    setCheckoutLoading(true);
    try {
      // --- NUEVA VALIDACIÃ“N DE DISPONIBILIDAD EN TIEMPO REAL ---
      const uniqueLocalIds = [...new Set(cart.items.map(i => i.local_id).filter(Boolean))];
      const uniqueItemIds = [...new Set(cart.items.map(i => i.menuId || i.id))];

      const availability = await api.validateOrderAvailability(uniqueLocalIds, uniqueItemIds);

      // 1. Validar Locales
      for (const localId of uniqueLocalIds) {
        const freshLocal = availability.locales.find(l => l.id === localId);
        if (!freshLocal) {
          toast.error("Uno de los locales ya no está disponible.");
          setCheckoutLoading(false);
          return;
        }
        if (!isLocalOpen(freshLocal)) {
          toast.error(`El local "${freshLocal.nombre}" acaba de cerrar o no está aceptando pedidos en este momento.`);
          setCheckoutLoading(false);
          return;
        }
      }

      // 2. Validar Platos
      for (const item of cart.items) {
        const freshItem = availability.items.find(i => i.id === (item.menuId || item.id));
        if (!freshItem || !freshItem.disponibilidad) {
          toast.error(`El plato "${item.nombre}" ya no está disponible.`);
          setCheckoutLoading(false);
          return;
        }
      }
      // --- FIN VALIDACIÃ“N ---

      // 7. Calculate exact prices using new logic
      const calcSubtotal = cart.items.reduce((sum, i) => sum + (Number(i.precio) * i.qty), 0);
      const shipping = cart.deliveryType === 'envio' ? cart.COSTO_ENVIO : 0;
      
      const finalTotals = calculateCheckoutTotals(calcSubtotal, shipping, mp);
      const exactTotal = finalTotals.total;

      const orderItems = cart.items.map(i => ({
        id: i.menuId || i.id, 
        nombre: i.descripcion ? `${i.nombre} (${i.descripcion})` : i.nombre,
        precio: Number(i.precio),
        cantidad: i.qty, 
        local_id: i.local_id || '',
        subtotal: Number(i.precio) * i.qty
      }));

      const orderInfo = {
        direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
        tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
        metodoPago: mp, 
        observaciones: (fd.get('observaciones') || '') + (addressData.reference ? ` | Ref: ${addressData.reference}` : ''),
        emailCliente: user.email, 
        nombreCliente: user.name,
        totalCalculado: exactTotal,
        lat: addressData.lat,
        lng: addressData.lng,
        precioEnvio: shipping,
        walletDiscount: checkoutTotals.walletDiscount || 0,
        platform_gross: finalTotals.platform_gross || 0,
        platform_net: finalTotals.platform_net || 0,
        merchant_payout: finalTotals.merchant_payout || 0
      };

      // 3. Handle Flow
      const pregeneratedId = 'ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase();
      
      // Unificamos el estado inicial: si es envío, buscamos repartidor broadcast
      const initialState = (cart.deliveryType === 'envio') ? 'Buscando Repartidor' : (mp === 'efectivo' ? 'Pendiente' : 'Pendiente de Pago');

      const orderDataForCreation = {
        userId: user.id,
        pedidoId: pregeneratedId,
        direccion: cart.deliveryType === 'envio' ? dir : 'Retiro en local',
        tipoEntrega: cart.deliveryType === 'envio' ? 'Con Envío' : 'Para Retirar',
        metodoPago: mp, 
        observaciones: (fd.get('observaciones') || '') + (addressData.reference ? ` | Ref: ${addressData.reference}` : ''),
        items: orderItems,
        emailCliente: user.email, 
        nombreCliente: user.name,
        estadoInicial: initialState,
        totalCalculado: exactTotal,
        lat: addressData.lat,
        lng: addressData.lng,
        precioEnvio: shipping,
        creditoWallet: useWallet ? (checkoutTotals.walletDiscount || 0) : 0
      };

      if (cart.deliveryType === 'envio' || mp === 'efectivo' || mp === 'transferencia') {
         // Creamos el pedido base
         const response = await api.crearPedido(orderDataForCreation);

         if (!response.success) throw new Error("No se pudo crear el pedido base.");

         const pendingOrderInfo = {
            pedidoId: pregeneratedId,
            cart: cart.items,
            total: exactTotal,
            localId: cart.items[0]?.local_id,
            metodoPago: mp,
            orderItems: orderItems,
            direccion: orderDataForCreation.direccion,
            tipoEntrega: orderDataForCreation.tipoEntrega,
            observaciones: orderDataForCreation.observaciones,
            platform_gross: finalTotals.platform_gross || 0
         };

         localStorage.setItem('pendingOrderDataPruebas', JSON.stringify(pendingOrderInfo));

         if (cart.deliveryType === 'envio') {
            setPendingOrderId(pregeneratedId);
            setSearchingDriver(true);
            setSearchSeconds(0);
            setFoundDriver(null);
            setDriverSearchTimeout(false);
            setCartOpen(false);

            // Iniciamos el broadcast centralizado
            await api.broadcastOrderToDrivers(pregeneratedId, exactTotal, cart.items[0]?.local_id).catch(console.error);
            return;
         } else {
            // RETIRO + EFECTIVO
            if (mp === 'efectivo') {
              toast.success(`¡Pedido #${pregeneratedId} registrado exitosamente!`);
              api.notifyLocalsAboutNewOrder(pregeneratedId, cart.items, 'Retiro en local', 'Para Retirar', orderDataForCreation.observaciones, mp).catch(e => console.error(e));
              cart.clearCart();
              setCartOpen(false);
            } else {
              // RETIRO + TRANSFERENCIA: Redirigir a MP
              triggerMPCheckout(pendingOrderInfo);
            }
            return;
         }
      }
    } catch (err) { 
      toast.error('Error al realizar el pedido: ' + err.message); 
      console.error("DETALLE ERROR CHECKOUT:", err);
    }
    setCheckoutLoading(false);
  };

  // Check repartidores when cart opens
  const openCart = async () => {
    try {
      const r = await api.checkActiveRepartidores();
      console.log("DEBUG: checkActiveRepartidores result:", r);
      setHasRepartidores(r.hasActive);
      if (!r.hasActive) {
        console.log("DEBUG: No drivers found");
      }
    } catch (err) { 
      console.error("DEBUG: Error in openCart check:", err);
    }
    setCartOpen(true);
  };

  // Effect to handle search timer
  React.useEffect(() => {
    let timer;
    if (searchingDriver && !foundDriver && !driverSearchTimeout) {
      timer = setInterval(() => {
        setSearchSeconds(prev => {
          if (prev >= 60) { // After 1 minute of UNACCEPTED search
            setDriverSearchTimeout(true);
            return 60; 
          }
          
          // Re-enviar Push cada 25 segundos para incentivar
          if (prev > 0 && prev % 25 === 0 && pendingOrderId) {
            console.log("📢 Re-enviando push de incentivo...");
            api.broadcastOrderToDrivers(pendingOrderId, cart.total, cart.items[0]?.local_id).catch(console.error);
          }
          
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [searchingDriver, foundDriver, driverSearchTimeout, pendingOrderId, cart.total]);

  // Effect to listen for driver acceptance via Realtime + Polling Fallback
  React.useEffect(() => {
    if (!pendingOrderId || !searchingDriver || foundDriver) return;

    console.log("ðŸ“¡ Subscribing to order updates for:", pendingOrderId);

    const checkStatus = async () => {
      try {
        const { data } = await api.supabase
          .from('pedidos_general')
          .select('estado, repartidor_id')
          .eq('id', pendingOrderId)
          .single();
          
        if (data && (data.estado === 'Pendiente de Pago' || data.estado === 'Confirmado') && !foundDriver) {
          console.log("âœ… Order accepted (Detected via Polling/Initial Check)!");
          handleDriverFound(data);
          return true;
        }
      } catch (err) {
        console.error("Error checking order status:", err);
      }
      return false;
    };

    // 1. Initial Check
    checkStatus();

    // 2. Realtime Listener
    const channel = api.supabase
      .channel(`order_status_${pendingOrderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'pedidos_general',
        filter: `id=eq.${pendingOrderId}`
      }, (payload) => {
        const newOrder = payload.new;
        console.log("🔄 Realtime update:", newOrder.id, newOrder.estado);
        if ((newOrder.estado === 'Pendiente de Pago' || newOrder.estado === 'Confirmado') && !foundDriver) {
          handleDriverFound(newOrder);
        }
      })
      .subscribe();

    // 3. Polling Fallback (Every 4 seconds)
    const pollInterval = setInterval(() => {
      if (!foundDriver) checkStatus();
      else clearInterval(pollInterval);
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      api.supabase.removeChannel(channel);
    };
  }, [pendingOrderId, searchingDriver, foundDriver]);

  const handleDriverFound = async (orderData) => {
    try {
      const { data: rep } = await api.supabase
        .from('repartidores')
        .select('nombre, foto_url')
        .eq('id', orderData.repartidor_id)
        .single();
      
      setFoundDriver(rep || { nombre: 'Repartidor' });
      setEstimatedTime('25-45 min');
      toast.success('¡Repartidor encontrado! 🚀');
      
      // Clear flags and close modal after a short delay
      setTimeout(async () => {
        const pendingRaw = localStorage.getItem('pendingOrderDataPruebas');
        if (pendingRaw) {
          const pendingData = JSON.parse(pendingRaw);
          if (pendingData.metodoPago === 'efectivo') {
            try {
              toast.success('¡Pedido confirmado!');
              setSearchingDriver(false);
              setFoundDriver(null);
              setPendingOrderId(null);
              localStorage.removeItem('pendingOrderDataPruebas');
            } catch (err) {
              console.error("Error confirming cash order UI:", err);
            }
          } else {
            triggerMPCheckout(orderData);
          }
        }
      }, 3500);

    } catch (e) {
      console.error("Error fetching driver info:", e);
    }
  };

  const triggerMPCheckout = async (originalOrder) => {
    const loadingToast = toast.loading('Abriendo Mercado Pago...');
    try {
      const pendingRaw = localStorage.getItem('pendingOrderDataPruebas');
      if (!pendingRaw) throw new Error('No se encontró la información del pedido');
      
      const pendingData = JSON.parse(pendingRaw);
      const successUrl = "https://wepi.com.ar/pedir";
      
      const paymentData = {
        external_reference: pendingData.pedidoId,
        back_urls: { success: successUrl, failure: successUrl, pending: successUrl },
        auto_return: "approved",
        items: [{
          title: `Pedido Wepi #${pendingData.pedidoId}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: Number(pendingData.total)
        }],
        local_id: cart.items[0]?.local_id,
        marketplace_fee: pendingData.platform_gross
      };

      const paymentResponse = await iniciarPagoMercadoPago(paymentData);

      if (paymentResponse?.init_point) {
        toast.dismiss(loadingToast);
        
        // Use standard key for return handling
        localStorage.setItem('pendingOrderData', JSON.stringify({
           ...pendingData,
           preferenceId: paymentResponse.id,
           externalReference: pendingData.pedidoId
        })); 
        localStorage.removeItem('pendingOrderDataPruebas');
        
        window.location.href = paymentResponse.init_point;
      } else {
        throw new Error(paymentResponse?.error || 'No se pudo generar el link de pago');
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Error al iniciar Mercado Pago: ' + err.message);
      setSearchingDriver(false);
    }
  };

  const categories = [
    { type: 'Hamburguesas', label: 'Burguers', img: 'https://i.postimg.cc/VLtZ23Km/descarga-(1)-(8).jpg' },
    { type: 'Helados', label: 'Helados', img: 'https://i.postimg.cc/VLPKFCY9/buscamos-repartidores-(18).png' },
    { type: 'Pizzas', label: 'Pizzas', img: 'https://i.postimg.cc/cJkcvmFw/descarga-(1)-(10).jpg' },
    { type: 'Empanadas', label: 'Empanadas', img: 'https://i.postimg.cc/KYjPhTmk/descarga-(1)-(11).jpg' },
    { type: 'Panchos', label: 'Panchos', img: 'https://i.postimg.cc/XqcCXxZr/buscamos-repartidores-(30).png' },
    { type: 'Panadería', label: 'Panadería', img: 'https://i.postimg.cc/HnYWFwgm/descarga-(1)-(13).jpg' },
    { type: 'Combos', label: 'Combos', img: 'https://i.postimg.cc/1X1wQDX5/buscamos-repartidores-(19).png' },
    { type: 'Bebidas', label: 'Bebidas', img: 'https://i.postimg.cc/KvhCcGkT/descarga-(1)-(14).jpg' },
    { type: 'favoritos', label: 'Mis favoritos', img: 'https://i.postimg.cc/RCktgLyZ/buscamos-repartidores-(7).png' },
  ];

  // Show drinks carousel when no drink in cart and delivery is envio
  const showDrinks = cart.items.length > 0 && cart.deliveryType === 'envio' && !cart.hasDrink && drinks.length > 0;

  return (
    <div className="customer-app">
      <header className="app-header">
        <Link to="/" className="app-logo-link">
          <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" className="app-logo" />
        </Link>
        <div className="search-wrapper">
          <img src="https://i.postimg.cc/TPXmybcH/18611-(1)-(2).png" alt="Buscar" className="search-icon" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          <input type="text" placeholder="Buscar menús o locales..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        </div>
        <div className="header-actions">
          {user && (
            <div className="wallet-header-badge" onClick={() => setModal('profile')}>
               <img src="https://i.postimg.cc/wj0SPCb4/descarga-(31)-(7).png" alt="Wallet" className="wallet-icon-img" style={{ width: 22, height: 22, objectFit: 'contain' }} />
               <span className="wallet-val">
                 {walletBalance === null ? '...' : `$${(walletBalance || 0).toLocaleString()}`}
               </span>
            </div>
          )}
          <button className="profile-btn" onClick={() => user ? setModal('profile') : setModal('login')}>
            <img src="https://i.postimg.cc/1RWxRcKM/18611-(1)-(1).png" alt="Perfil" className="profile-avatar-img" />
            <span className="hide-mobile">{user ? 'Mi Perfil' : 'Ingresar'}</span>
          </button>
          <button className="cart-btn" onClick={openCart}>
            <img src="https://i.postimg.cc/QCcjwFRf/18611-(1).png" alt="Carrito" className="cart-icon-img" />
            {cart.totalItems > 0 && <span className="cart-badge">{cart.totalItems}</span>}
          </button>
        </div>
      </header>

      {!hasRepartidores && (
          <div className="no-drivers-alert animate-fade-in" style={{
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            padding: '10px 20px',
            textAlign: 'center',
            color: '#92400e',
            fontSize: '0.85rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span> No hay repartidores disponibles en este momento, vuelve intentar en unos minutos. Solo retiro en local disponible.
          </div>
        )}

      <main className="app-main">
        <div className="banners-container" style={{ marginBottom: '20px' }}>
          {user && hasActiveOrder && (
            <div className="active-order-banner" style={{
              background: '#ff9800',
              color: 'white',
              padding: '12px 20px',
              textAlign: 'center',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              borderBottom: '2px solid #e68a00',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(255,152,0,0.3)',
              fontWeight: '600',
              zIndex: 90
            }}>
              <span>🛵 ¡Tienes un pedido en proceso!</span>
                            <button 
                onClick={() => navigate('/mis-pedidos')} 
                style={{
                  background: 'white',
                  color: '#ff9800',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                Ver Mis Pedidos
              </button>
            </div>
          )}
        </div>
        
        {/* ——— Banners Carousel ——— */}
        {!bannersLoading && banners.length > 0 && (
          <div className="banners-carousel-wrapper animate-fade-in">
            <div className="banners-carousel">
              {banners.map(b => (
                <div 
                  key={b.id} 
                  className={`banner-slide ${b.link ? 'clickable' : ''}`}
                  onClick={() => b.link && window.open(b.link, '_blank')}
                >
                  <img 
                    src={b.imagen_url} 
                    alt="Promo" 
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="app-greeting-container">
          {user && !user.telefono && (
            <div className="missing-phone-banner">
              <div className="missing-phone-content">
                <span className="missing-phone-icon">📞</span>
                <div>
                  <p style={{ margin: 0 }}>¡Completá tu cuenta!</p>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Agregá tu teléfono para que el repartidor pueda contactarte.</span>
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => setModal('editProfile')}>
                Agregar ahora
              </button>
            </div>
          )}
        </div>

        {/* ─── HOME SCREEN ─── */}
        {!showMenus && !filteredLocals && (
          <div className="home-screen animate-fade-in">
             {/* 1. BLOQUE DINÁMICO PRINCIPAL (Banner) */}
             <section className="home-section dynamic-banner-section">
               <div 
                 className="dynamic-banner animate-fade-in" 
                 onClick={handleBannerClick}
               >
                 <img src={homeLayout.dynamicBanner} alt={homeLayout.dynamicTitle} />
                 <div className="banner-overlay">
                   <h2>{homeLayout.dynamicTitle}</h2>
                   <button className="banner-btn">Ver locales ➔</button>
                 </div>
               </div>
             </section>
              <div className="home-brand-message-box" style={{ padding: '0 20px', margin: '24px 0 12px', textAlign: 'center' }}>
                <p className="home-brand-quote" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.5px' }}>
                  Todo lo que buscás, <span style={{ color: 'var(--red-600)' }}>está en Wepi.</span>
                </p>
              </div>
             {/* 2. RUBROS PRINCIPALES (Imágenes circulares) */}
             <section className="home-section rubros-categories">

               <div className="categories-grid-home">
                 {homeLayout.categories.map(cat => (
                   <div key={cat.label} className="home-category-card-square" onClick={() => fetchByCategory(cat.type)}>
                     <img src={cat.img} alt={cat.label} />
                     <div className="category-overlay">
                       <span>{cat.label}</span>
                     </div>
                   </div>
                 ))}
               </div>
             </section>
             {/* 3. LOCALES DESTACADOS (PRO) */}
             {homeLayout.featuredProLocales.length > 0 && (
               <section className="home-section pro-locales">
                  <div className="section-header-simple">
                    <h2>Locales destacados <img src="https://i.postimg.cc/50W06p4z/descarga-(31).png" style={{ height: '26px', marginLeft: '10px', verticalAlign: 'middle' }} alt="" /></h2>
                  </div>
                  <div className="horizontal-scroll-premium">
                    {homeLayout.featuredProLocales.map((local) => {
                      const open = isLocalOpen(local);
                      return (
                        <div key={local.id} className={`suggestion-circle-home ${open ? '' : 'is-closed'}`} onClick={() => fetchMenusByLocal(local.id)}>
                          <div className={`logo-box ${open ? 'online' : 'offline'}`} style={{ border: open ? '2px solid #a855f7' : '' }}>
                            <img src={local.logo} alt={local.nombre} />
                            {open && <span className="online-dot-mini" />}
                          </div>
                          <span className="local-status-label">{getLocalStatusText(local)}</span>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}

             
             {/* 4. PROMOS DEL DÍA */}
             {homeLayout.promosOfDay.length > 0 && (
               <section className="home-section promos-imperdibles">
                 <div className="section-header-with-link">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      PROMOS IMPERDIBLES
                      <img src="https://i.postimg.cc/c4T1cbZf/descarga-(31)-(6).png" alt="" style={{ height: '28px', width: '28px', objectFit: 'contain' }} />
                    </h2>
                   <button className="view-all-btn">Ver más</button>
                 </div>
                 <div className="horizontal-scroll-items" style={{ gap: '12px', padding: '10px 4px' }}>
                     {homeLayout.promosOfDay.map((item) => {
                        const loc = locals.find(l => l.id === item.local_id);
                        const open = isLocalOpen(loc);
                        return (
                          <div 
                            key={item.id} 
                            className={`item-promo-card-vertical animate-fade-in ${open ? '' : 'is-closed'}`}
                            onClick={() => open && handleAddToCart(item)}
                          >
                            <div className="promo-vertical-img">
                              <img src={item.imagen_url} alt={item.nombre} />
                              {(() => {
                                const discountedPrice = calculateDiscountedPrice(item);
                                if (discountedPrice < Number(item.precio)) {
                                  const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                                  return <div className="promo-badge-mini">{percent}% OFF</div>;
                                }
                                return null;
                              })()}

                            </div>
                            <div className="promo-vertical-info">
                              <span className="promo-item-name">{item.nombre}</span>
                              {renderCreditBadge(item)}
                              <div className="promo-price-row">
                                <span className="price-now">${calculateDiscountedPrice(item).toLocaleString()}</span>
                                {calculateDiscountedPrice(item) < Number(item.precio) && <span className="price-was">${Number(item.precio).toLocaleString()}</span>}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="promo-local-label">{item.local_nombre}</span>
                                {open ? (
                                  <button className="promo-mini-add-btn" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>+</button>
                                ) : (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: '700' }}>
                                    {item.local_nombre?.toUpperCase() === 'FULL' ? 'Próximamente' : 'Cerrado'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </section>
              )}
{/* 5. LOCALES RECOMENDADOS (PLUS) */}
             {homeLayout.recommendedPlusLocales.length > 0 && (
               <section className="home-section plus-locales">
                  <div className="section-header-simple">
                    <h2>Locales recomendados <img src="https://i.postimg.cc/K8dcHQg5/descarga-(31)-(4).png" style={{ height: '26px', marginLeft: '10px', verticalAlign: 'middle' }} alt="" /></h2>
                  </div>
                  <div className="horizontal-scroll-premium">
                    {homeLayout.recommendedPlusLocales.map((local) => {
                      const open = isLocalOpen(local);
                      return (
                        <div key={local.id} className={`suggestion-circle-home ${open ? '' : 'is-closed'}`} onClick={() => fetchMenusByLocal(local.id)}>
                          <div className={`logo-box ${open ? 'online' : 'offline'}`} style={{ border: open ? '2px solid #f59e0b' : '' }}>
                            <img src={local.logo} alt={local.nombre} />
                            {open && <span className="online-dot-mini" />}
                          </div>
                          <span className="local-status-label">{getLocalStatusText(local)}</span>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}

             
                           {/* 5.5 LO MÁS PEDIDO (Igual a Promos, sin Corazón) */}
             {homeLayout.mostOrdered && homeLayout.mostOrdered.length > 0 && (
               <section className="home-section top-ordered">
                  <div className="section-header-simple">
                    <h2>Lo más pedido 🔥</h2>
                  </div>
                  <div className="horizontal-scroll-items" style={{ gap: '12px', padding: '10px 4px' }}>
                    {homeLayout.mostOrdered.map((item) => {
                      const loc = locals.find(l => l.id === item.local_id);
                      const open = isLocalOpen(loc);
                      return (
                        <div 
                          key={item.id} 
                          className={`item-promo-card-vertical animate-fade-in ${open ? '' : 'is-closed'}`} 
                          onClick={() => open && handleAddToCart(item)}
                        >
                           <div className="promo-vertical-img">
                              <img src={item.imagen_url} alt={item.nombre} />
                              {(() => {
                                const discountedPrice = calculateDiscountedPrice(item);
                                if (discountedPrice < Number(item.precio)) {
                                  const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                                  return <div className="promo-badge-mini">{percent}% OFF</div>;
                                }
                                return null;
                              })()}

                              
                           </div>
                           <div className="promo-vertical-info">
                              <span className="promo-item-name">{item.nombre}</span>
                              {renderCreditBadge(item)}
                              <div className="promo-price-row">
                                 <span className="price-now">${calculateDiscountedPrice(item).toLocaleString()}</span>
                                  {calculateDiscountedPrice(item) < Number(item.precio) && (
                                    <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)', marginLeft: '8px' }}>
                                      ${Number(item.precio).toLocaleString()}
                                    </span>
                                  )}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                 <span className="promo-local-label">{item.local_nombre}</span>
                                 {open ? (
                                   <button className="promo-mini-add-btn" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>+</button>
                                 ) : (
                                   <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: '700' }}>
                                     {item.local_nombre?.toUpperCase() === 'FULL' ? 'Próximamente' : 'Cerrado'}
                                   </span>
                                 )}
                              </div>
                           </div>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}
{/* 6. NUEVOS LOCALES (FREEMIUM) */}
             {homeLayout.newFreemiumLocales.length > 0 && (
               <section className="home-section new-locales-home">
                  <div className="section-header-simple">
                    <h2>Otros locales <img src="https://i.postimg.cc/0249zZZy/descarga-(31)-(5).png" style={{ height: '26px', marginLeft: '10px', verticalAlign: 'middle' }} alt="" /></h2>
                  </div>
                  <div className="horizontal-scroll-premium">
                    {homeLayout.newFreemiumLocales.map((local) => {
                      const open = isLocalOpen(local);
                      return (
                        <div key={local.id} className={`suggestion-circle-home ${open ? '' : 'is-closed'}`} onClick={() => fetchMenusByLocal(local.id)}>
                          <div className={`logo-box ${open ? 'online' : 'offline'}`}>
                            <img src={local.logo} alt={local.nombre} />
                            {open && <span className="online-dot-mini" />}
                          </div>
                          <span className="local-status-label">{getLocalStatusText(local)}</span>
                        </div>
                      );
                    })}
                  </div>
               </section>
             )}
{/* 7. EXPLORAR (Grid de Items) */}
             <section className="home-section explore-items">
                <div className="section-header-simple">
                  <h2>Explorar más productos 🛵</h2>
                </div>

                {/* FILTROS EXPLORAR */}
                <div className="explore-filters" style={{ padding: '0 16px', marginBottom: '24px' }}>
                  <div className="filter-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gray-700)', marginBottom: '8px', display: 'block' }}>Rubros</label>
                    <div className="horizontal-scroll-chips" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                      <button 
                        className={`filter-chip ${exploreRubroFilter === '' ? 'active' : ''}`}
                        onClick={() => { setExploreRubroFilter(''); }}
                      >
                        Todo
                      </button>
                      {[...new Set(homeLayout.exploreItems.map(i => i.local_rubro).filter(Boolean))].map(rubro => (
                        <button 
                          key={rubro}
                          className={`filter-chip ${exploreRubroFilter === rubro ? 'active' : ''}`}
                          onClick={() => { setExploreRubroFilter(rubro); }}
                        >
                          {rubro}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="filter-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--gray-700)', marginBottom: '8px', display: 'block' }}>Categorías</label>
                    <div className="horizontal-scroll-chips" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                      <button 
                        className={`filter-chip ${exploreCatFilter === '' ? 'active' : ''}`}
                        onClick={() => setExploreCatFilter('')}
                      >
                        Todas
                      </button>
                      {[...new Set(homeLayout.exploreItems.map(i => i.categoria).filter(Boolean))].sort().map(cat => (
                        <button 
                          key={cat}
                          className={`filter-chip ${exploreCatFilter === cat ? 'active' : ''}`}
                          onClick={() => setExploreCatFilter(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="explore-items-list">
                   {exploreRubroFilter || exploreCatFilter ? (
                     homeLayout.exploreItems
                      .filter(item => {
                        const rubroOk = !exploreRubroFilter || item.local_rubro === exploreRubroFilter;
                        const catOk = !exploreCatFilter || item.categoria === exploreCatFilter;
                        return rubroOk && catOk;
                      })
                      .map((item) => (
                      <div 
                        key={item.id} 
                        className="menu-card card card-hover" 
                        style={{ cursor: 'pointer' }}
                        onClick={() => fetchMenusByLocal(item.local_id)}
                      >
                        <div className="menu-card-img-container">
                          <img src={item.imagen_url} alt={item.nombre} className="menu-card-img" />
                          {(() => {
                            const discountedPrice = calculateDiscountedPrice(item);
                            if (discountedPrice < Number(item.precio)) {
                              const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                              return <div className="menu-discount-badge">{percent}% OFF</div>;
                            }
                            return null;
                          })()}
                          </div>
                        <div className="menu-card-body">
                          <div className="menu-card-local">
                            {item.local_logo && <img src={item.local_logo} alt="" className="menu-local-logo" />}
                            <span>{item.local_nombre}</span>
                          </div>
                          <h3>{item.nombre}</h3>
                          {renderCreditBadge(item)}
                          {item.descripcion && <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', margin: '4px 0', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.descripcion}</p>}
                          <div className="menu-card-footer">
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="menu-card-price" style={{ color: 'inherit' }}>${calculateDiscountedPrice(item).toLocaleString()}</span>
                              {calculateDiscountedPrice(item) < Number(item.precio) && (
                                <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                                  ${Number(item.precio).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="menu-card-actions">
                              {(() => {
                                const loc = locals.find(l => l.id === item.local_id);
                                if (loc && isLocalOpen(loc)) {
                                  return (
                                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>
                                      Agregar
                                    </button>
                                  );
                                }
                                return (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: 'bold' }}>
                                    {loc?.nombre?.toUpperCase() === 'FULL' ? 'PRÓXIMAMENTE' : 'CERRADO'}
                                  </span>
                                );
                              })()}
                              <button 
                                className={`fav-btn ${favorites.includes(item.id) ? 'active' : ''}`}
                                onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }}
                              >
                                <img 
                                  src={favorites.includes(item.id) ? "https://i.postimg.cc/BZYZmSz1/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find.png" : "https://i.postimg.cc/W4Gb8MRV/Instagram-Heart-Png-Love-Heart-Transparent-Png(1000x1000)-Png-Find(1).png"} 
                                  style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                                  alt="Favorito" 
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                   ) : (
                     <div style={{ height: '40px' }}></div>
                   )}
                </div>
             </section>
          </div>
        )}

        {/* ─── RUBRO EXPLORER (Explorer View) ─── */}
        {filteredLocals && !showMenus && (
          <div className="explorer-view animate-fade-in">
             <div className="category-chips-sticky">
                <button className={`chip ${!selectedCategory ? 'active' : ''}`} onClick={() => { setFilteredLocals(null); setSelectedCategory(null); }}>
                  Inicio
               </button>
               {homeLayout.categories.map(cat => (
                 <button 
                  key={cat.label} 
                  className={`chip ${selectedCategory === cat.type ? 'active' : ''}`} 
                  onClick={() => fetchByCategory(cat.type)}
                >
                   {cat.label}
                 </button>
               ))}
             </div>

              <section className="locals-section">
                <div className="section-header-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 className="locals-title">Locales con {selectedCategory || 'Explorar'}</h2>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '6px 12px' }} onClick={() => { setFilteredLocals(null); setSelectedCategory(null); }}>✕ Ver todos</button>
                </div>
                
                {loadingLocals ? (
                  <div className="loading-state-premium">Buscando los mejores locales...</div>
                ) : filteredLocals.length === 0 ? (
                  <div className="empty-state-premium">Próximamente en Wepi</div>
                ) : (
                  <div className="locals-scroll" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px' }}>
                    {filteredLocals.map((local) => {
                      const open = isLocalOpen(local);
                      return (
                        <button 
                          key={local.id} 
                          className={`suggestion-categoria ${open ? 'open' : 'closed'}`} 
                          onClick={() => fetchMenusByLocal(local.id)}
                          style={{ flex: '0 0 auto', border: 'none', outline: 'none' }}
                        >
                          <img src={local.logo} alt={local.nombre} />
                          <div className="suggestion-info">
                            <div className="local-name">{local.nombre}</div>
                            {open ? (
                              <div className="categoria-precio">
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                  <span className="cat">{local.rubro}</span>
                                </div>
                                <span className="precio-min">desde ${local.precio_min || '10'}</span>
                              </div>
                            ) : (
                              <div className="availability-badge" style={{ color: 'var(--red-600)', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                {local.nombre?.toUpperCase() === 'FULL' ? 'PRÓXIMAMENTE' : 'CERRADO'}
                              </div>
                            )}
                          </div>
                          {open && <span className="open-dot" style={{ position: 'absolute', top: '5px', right: '5px', width: '12px', height: '12px', borderRadius: '50%', background: '#00c853', border: '2px solid white' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Discovery Items (Menu Cards in Explorer View) */}
              {(loadingDiscovery || discoveryItems.length > 0) && (
                <section className="locals-section items-discovery-section animate-fade-in" style={{ marginTop: '32px', borderTop: '1px solid var(--gray-100)', paddingTop: '24px' }}>
                  <div className="section-header-premium" style={{ marginBottom: '16px' }}>
                    <h2 className="locals-title">Productos Sugeridos ✨</h2>
                  </div>
                  
                  {loadingDiscovery ? (
                    <div className="loading-state-premium">Buscando productos...</div>
                  ) : (
                    <div className="explore-items-list">
                      {discoveryItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="menu-card card card-hover" 
                          style={{ cursor: 'pointer' }}
                          onClick={() => fetchMenusByLocal(item.local_id)}
                        >
                          <div className="menu-card-img-container">
                            <img src={item.imagen_url} alt={item.nombre} className="menu-card-img" />
                            {(() => {
                              const discountedPrice = calculateDiscountedPrice(item);
                              if (discountedPrice < Number(item.precio)) {
                                const percent = Math.round((1 - discountedPrice / Number(item.precio)) * 100);
                                return <div className="menu-discount-badge">{percent}% OFF</div>;
                              }
                              return null;
                            })()}
                            </div>
                          <div className="menu-card-body">
                            <div className="menu-card-local">
                              {item.local_logo && <img src={item.local_logo} alt="" className="menu-local-logo" />}
                              <span>{item.local_nombre}</span>
                            </div>
                            <h3>{item.nombre}</h3>
                            {renderCreditBadge(item)}
                            <div className="menu-card-footer">
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="menu-card-price">${calculateDiscountedPrice(item).toLocaleString()}</span>
                                {calculateDiscountedPrice(item) < Number(item.precio) && (
                                  <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                                    ${Number(item.precio).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              {(() => {
                                const loc = locals.find(l => l.id === item.local_id);
                                if (loc && isLocalOpen(loc)) {
                                  return (
                                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}>
                                      Agregar
                                    </button>
                                  );
                                }
                                return (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--red-600)', fontWeight: 'bold' }}>
                                    {loc?.nombre?.toUpperCase() === 'FULL' ? 'PRÓXIMAMENTE' : 'CERRADO'}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
          </div>
        )}

        {/* ─── LOCAL MENU (Menu View) ─── */}
        {showMenus && (
          <div className="menu-view animate-fade-in">
             <div className="menu-header-sticky">
                <button className="back-btn-premium" onClick={() => setShowMenus(false)}>← Volver</button>
                <h2 className="menu-local-title">{selectedLocal?.nombre}</h2>
             </div>

             <div className="menu-content-premium">
               {loadingMenus ? (
                 <div className="loading-state-premium">Cargando el menú...</div>
               ) : (
                 <>
                   {/* Categorías del Local */}
                   <div className="local-categories-nav">
                                           {menus.some(m => doesItemEarnCredit(m)) && (
                        <button className="local-cat-chip" style={{ background: 'var(--sky-50)', color: 'var(--sky-700)', borderColor: 'var(--sky-200)', fontWeight: 'bold' }} onClick={() => {
                          document.getElementById(`cat-credito`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}>
                          Ganá créditos 💰
                        </button>
                      )}
                      {Array.from(new Set(menus.map(m => m.categoria))).filter(c => c && c !== 'Base').map(cat => (

                       <button key={cat} className="local-cat-chip" onClick={() => {
                         document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                       }}>
                         {cat}
                       </button>
                     ))}
                   </div>

                   {/* Listado de Productos Agrupados */}
                                       {/* Sección Especial: Ganá Créditos */}
                    {menus.some(m => doesItemEarnCredit(m)) && (
                      <section id="cat-credito" className="menu-category-section">
                         <h3 className="category-group-title" style={{ color: 'var(--sky-700)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           Ganá créditos 💰
                         </h3>
                         <div className="menu-list-wallet" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {menus
                              .filter(m => doesItemEarnCredit(m))
                              .map((item) => renderMenuItem(item))}
                         </div>
                      </section>
                    )}

                    {/* Listado de Productos Agrupados */}
                    {Array.from(new Set(menus.map(m => m.categoria))).filter(c => c && c !== 'Base').map(cat => (
                      <section key={cat} id={`cat-${cat}`} className="menu-category-section">
                         <h3 className="category-group-title">{cat}</h3>
                         <div className="menu-list-wallet" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {menus
                              .filter(m => m.categoria === cat)
                              .sort((a, b) => (doesItemEarnCredit(b) ? 1 : 0) - (doesItemEarnCredit(a) ? 1 : 0))
                              .map((item) => renderMenuItem(item))}
                         </div>
                      </section>
                    ))}
                 </>
               )}
             </div>
          </div>
        )}      </main>
      {/* ─── Cart Sidebar ─── */}
      <div className={`cart-backdrop ${cartOpen ? 'active' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-sidebar ${cartOpen ? 'active' : ''}`}>
        <div className="cart-header-bar">
          <h2>Tu Carrito</h2>
          <button className="cart-close-btn" onClick={() => setCartOpen(false)}>✕</button>
        </div>
        <div className="cart-body-content">
          {!hasRepartidores && (
            <div 
              className="no-drivers-cart-top-notice animate-fade-in" 
              style={{
                background: '#fffbeb',
                color: '#92400e',
                fontSize: '0.9rem',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
                fontWeight: '700',
                border: '2px solid #fef3c7',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.1)'
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🚫</div>
              No hay repartidores disponibles en este momento.
              <p style={{ fontWeight: '400', fontSize: '0.8rem', marginTop: '4px', opacity: 0.9 }}>
                Vuelve a intentar en unos minutos para envíos a domicilio.
              </p>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Tipo de entrega</label>
            <select 
              className="form-select" 
              value={cart.deliveryType} 
              onChange={e => {
                const val = e.target.value;
                cart.setDeliveryType(val);

                if (val === 'envio') {
                  api.checkActiveRepartidores().then(fresh => {
                    setHasRepartidores(fresh.hasActive);
                    if (!fresh.hasActive) {
                      // Si al final no había, revertimos a retiro (si se permite)
                      const currentLocal = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);
                      if (currentLocal?.acepta_retiro === true) {
                        cart.setDeliveryType('retiro');
                      }
                    }
                  }).catch(() => {});
                }
              }}
              style={{ 
                borderColor: !hasRepartidores ? 'var(--amber-400)' : '',
                backgroundColor: !hasRepartidores ? '#fff9f0' : ''
              }}
            >
              {(() => {
                const currentLocal = selectedLocal || (cart.items.length > 0 ? locals.find(l => l.id === cart.items[0].local_id) : null);
                return (
                  <>
                    {(currentLocal?.acepta_envio !== false) && (
                      <option 
                        value="envio" 
                        disabled={!hasRepartidores}
                        style={{ color: !hasRepartidores ? '#999' : 'inherit' }}
                      >
                        {hasRepartidores ? 'Con envío a domicilio' : '🛵 Con envío (sin repartidores disponibles)'}
                      </option>
                    )}
                    {(currentLocal?.acepta_retiro === true) && (
                      <option value="retiro">🥡 Retirar en local</option>
                    )}
                  </>
                );
              })()}
            </select>
          </div>

          {cart.items.length === 0 ? (
            <div className="cart-empty">
              <img src="https://i.postimg.cc/QCcjwFRf/18611-(1).png" alt="Carrito Vacío" style={{ width: '64px', height: '64px', margin: '0 auto 16px', opacity: 0.8 }} />
              <p>Tu carrito está vacío</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setCartOpen(false)}>Seguir comprando</button>
            </div>
          ) : (
            <>
              {cart.items.map(item => (
                <div key={item.id} className="cart-item-row">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.nombre}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {item.precioOriginal > item.precio && (
                        <span style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                          ${(Number(item.precioOriginal) * item.qty).toLocaleString('es-AR')}
                        </span>
                      )}
                      <span className="cart-item-price" style={{ color: item.precioOriginal > item.precio ? 'var(--red-600)' : 'inherit' }}>
                        ${(Number(item.precio) * item.qty).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  <div className="cart-item-controls">
                    <button className="qty-btn" onClick={() => cart.updateQty(item.id, -1)}>−</button>
                    <span className="qty-display">{item.qty}</span>
                    <button className="qty-btn" onClick={() => cart.updateQty(item.id, 1)}>+</button>
                    <button className="remove-btn-small" onClick={() => cart.removeItem(item.id)}>🗑️</button>
                  </div>
                </div>
              ))}

              <div className="payment-method-selector" style={{ marginTop: '20px', marginBottom: '10px' }}>
                <label className="form-label">Seleccionar método de pago</label>
                <select 
                  className="form-select" 
                  value={metodoPago} 
                  onChange={e => setMetodoPago(e.target.value)}
                  style={{ marginBottom: '5px' }}
                >
                  <option value="" disabled>Elegí cómo pagar</option>
                  <option value="transferencia">Transferencia / Mercado Pago</option>
                  <option 
                    value="efectivo" 
                    disabled={orderCount === 0 || orderCount === null}
                    style={{ color: (orderCount === 0 || orderCount === null) ? '#999' : 'inherit' }}
                  >
                    { (orderCount === 0 || orderCount === null) ? 'Efectivo (Inhabilitado 1er pedido)' : 'Efectivo' }
                  </option>
                </select>
                
                {walletBalance > 0 && walletConfig && (
                  <div className="wallet-usage-cart animate-slide-up" style={{
                    padding: '12px',
                    background: '#f0f9ff',
                    borderRadius: '12px',
                    border: '1px solid #bae6fd',
                    marginTop: '15px'
                  }}>
                    <label className="wallet-cb-label" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      cursor: checkoutTotals.walletValidation?.canUse ? 'pointer' : 'not-allowed',
                      opacity: checkoutTotals.walletValidation?.canUse ? 1 : 0.7
                    }}>
                      <input 
                        type="checkbox" 
                        checked={useWallet && checkoutTotals.walletValidation?.canUse} 
                        onChange={e => checkoutTotals.walletValidation?.canUse && setUseWallet(e.target.checked)} 
                        disabled={!checkoutTotals.walletValidation?.canUse}
                      />
                      <div className="wallet-cb-info">
                        <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: '700', color: '#0369a1' }}>Utilizar crédito Wepi Wallet</span>
                        <span style={{ fontSize: '0.75rem', color: '#0ea5e9' }}>
                          Saldo disponible: <strong>{walletBalance === null ? 'Cargando...' : `$${(walletBalance || 0).toLocaleString()}`}</strong>
                        </span>
                        
                        {!checkoutTotals.walletValidation?.canUse && checkoutTotals.walletValidation?.reason && (
                          <div className="wallet-usage-warning" style={{
                            marginTop: '4px',
                            color: '#b91c1c',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>⚠️</span> {checkoutTotals.walletValidation.reason}
                          </div>
                        )}

                        {checkoutTotals.walletValidation?.canUse && checkoutTotals.maxAvailableDiscount < walletBalance && checkoutTotals.maxAvailableDiscount > 0 && (
                           <div style={{ fontSize: '0.68rem', color: '#0369a1', marginTop: '2px', fontStyle: 'italic' }}>
                             * Podés usar hasta ${checkoutTotals.maxAvailableDiscount.toLocaleString()} en este pedido.
                           </div>
                        )}
                      </div>
                    </label>
                  </div>
                )}

                {(orderCount === 0 || orderCount === null) && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--red-500)', marginTop: '4px', fontStyle: 'italic' }}>
                    * Por seguridad, tu primer pedido debe ser con Transferencia.
                  </p>
                )}
              </div>

              <div className="cart-summary">
                <div className="cart-line">
                  <span>{cart.deliveryType === 'retiro' ? 'Subtotal valor pedido' : 'Subtotal'}</span>
                  <span>${cart.subtotal.toLocaleString('es-AR')}</span>
                </div>
                {cart.deliveryType !== 'retiro' && metodoPago !== 'transferencia' && (
                  <div className="cart-line">
                    <span>
                      Envío
                      {cart.incentivoActivo > 0 && (
                        <span style={{ color: 'var(--red-500)', fontWeight: 600, marginLeft: 8, fontSize: '0.75rem' }}>
                          ⚡ Dinámica
                        </span>
                      )}
                    </span>
                    <span>{visibleShipping === 0 ? '¡GRATIS!' : `$${visibleShipping.toLocaleString('es-AR')}`}</span>
                  </div>
                )}
                {visibleMpFee > 0 && (
                  <div className="cart-line comision-line">
                    <span>{metodoPago === 'transferencia' ? 'Gestión (Envío + Operación)' : 'Gestión de pago'}</span>
                    <span>+${(metodoPago === 'transferencia' && cart.deliveryType !== 'retiro' ? (visibleMpFee + visibleShipping) : visibleMpFee).toLocaleString('es-AR')}</span>
                  </div>
                )}
                {useWallet && walletDiscountUI > 0 && (
                  <div className="cart-line wallet-discount-line" style={{ color: '#0369a1', fontWeight: '700' }}>
                    <span>Descuento Wepi Wallet</span>
                    <span>−${walletDiscountUI.toLocaleString()}</span>
                  </div>
                )}
                <div className="cart-line total-line">
                  <span>Total</span>
                  <span>${totalConComision.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                {potentialCredit > 0 && (
                  <div className="potential-credit-banner animate-pulse" style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: 'linear-gradient(90deg, #f0f9ff, #e0f2fe)',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    color: '#0284c7',
                    fontWeight: '800',
                    textAlign: 'center',
                    border: '1px solid #bae6fd'
                  }}>
                    ✨ ¡Sumarás <strong>${potentialCredit.toLocaleString()}</strong> de crédito con este pedido!
                  </div>
                )}
              </div>

              <form onSubmit={handleCheckout} className="checkout-form">
                {cart.deliveryType === 'envio' && (
                  <div className="address-selector-input-group" style={{ marginBottom: '16px', position: 'relative' }}>
                    <label className="form-label" style={{ display: 'block', textAlign: 'left', marginBottom: '8px' }}>
                      Dirección de entrega
                    </label>
                    <div 
                      className="input-with-icon" 
                      onClick={() => setShowAddressSelector(true)}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <input 
                        type="text"
                        className="form-input"
                        placeholder="📍 Seleccioná tu dirección en el mapa..."
                        value={addressData.address || ''}
                        readOnly
                        style={{ paddingLeft: '40px', cursor: 'pointer', backgroundColor: '#fff', border: '1px solid #ddd' }}
                      />
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem' }}>
                        📍
                      </span>
                    </div>
                    {addressData.address && (
                      <button 
                        type="button" 
                        className="btn-text" 
                        style={{ display: 'block', margin: '4px 0', fontSize: '0.8rem', color: 'var(--red-500)', fontWeight: 'bold' }}
                        onClick={() => setShowAddressSelector(true)}
                      >
                        (Cambiar ubicación)
                      </button>
                    )}
                    {addressData.reference && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '4px', textAlign: 'left' }}>
                        Ref: {addressData.reference}
                      </p>
                    )}
                  </div>
                )}
                {/* Observaciones removidas por solicitud */}
                <input type="hidden" name="observaciones" value="" />
                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={checkoutLoading}>
                  {checkoutLoading ? <span className="spinner spinner-white" /> : 'Realizar Pedido'}
                </button>
              </form>
            </>
          )}
        </div>
      </aside>

      {/* ─── Modals ─── */}
      {modal && (
        <div className="modal-overlay" onClick={() => { setModal(null); setShowPassword(false); }}>
          <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setModal(null); setShowPassword(false); }}>✕</button>

            {modal === 'login' && (
              <form onSubmit={handleLogin}>
                <h2>Iniciar Sesión</h2>
                <input name="email" type="email" className="form-input" placeholder="Email" required autoComplete="username" />
                <div className="password-container">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Contraseña" 
                    required 
                    autoComplete="current-password" 
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <img 
                      src={showPassword ? "https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" : "https://i.postimg.cc/Zq8grxNr/buscamos-repartidores-(9).png"} 
                      alt="Ver" 
                    />
                  </button>
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Entrar'}
                </button>
                <p className="modal-switch">¿No tenés cuenta? <button type="button" onClick={() => { setModal('register'); setShowPassword(false); }}>Registrate</button></p>
              </form>
            )}

            {modal === 'register' && (
              <form onSubmit={handleRegister}>
                <h2>Registro</h2>
                <input name="email" type="email" className="form-input" placeholder="Email" required autoComplete="username" />
                <input name="nombre" className="form-input" placeholder="Nombre completo" required autoComplete="name" />
                <div className="password-container">
                  <input 
                    name="password" 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    placeholder="Contraseña (6+ caracteres)" 
                    required 
                    autoComplete="new-password" 
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <img 
                      src={showPassword ? "https://i.postimg.cc/mrfJz5P3/buscamos-repartidores-(8).png" : "https://i.postimg.cc/Zq8grxNr/buscamos-repartidores-(9).png"} 
                      alt="Ver" 
                    />
                  </button>
                </div>
                <input name="direccion" className="form-input" placeholder="Dirección (opcional)" autoComplete="street-address" />
                <div className="phone-input-group">
                  <select name="prefix" className="phone-prefix-select">
                    <option value="+54">🇦🇷 +54</option>
                    <option value="+55">🇧🇷 +55</option>
                  </select>
                  <input name="telefono" type="tel" className="form-input phone-number-input" placeholder="Número (ej: 1123456789)" required autoComplete="tel-national" />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px', textAlign: 'left' }}>
                  <input type="checkbox" id="terms_accepted" name="terms_accepted" required style={{ width: 'auto', marginTop: '4px' }} />
                  <label htmlFor="terms_accepted" style={{ fontSize: '0.85rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                    Acepto los <button type="button" style={{ background: 'none', border: 'none', color: 'var(--red-500)', padding: 0, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' }} onClick={() => setModal('terms')}>Términos y Condiciones y Política de Privacidad</button> para Usuarios.
                  </label>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Registrarme'}
                </button>
                <p className="modal-switch">¿Ya tenés cuenta? <button type="button" onClick={() => { setModal('login'); setShowPassword(false); }}>Iniciar sesión</button></p>
              </form>
            )}

            {modal === 'profile' && user && (
              <div>
                <h2>Mi Perfil</h2>
                <div className="profile-info">
                  <p><strong>Nombre:</strong> {user.name}</p>
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Teléfono:</strong> {user.telefono || 'No configurado'}</p>
                  <p><strong>Dirección:</strong> {user.address || 'No configurada'}</p>
                  <div className="wallet-profile-status" style={{
                    marginTop: '12px',
                    padding: '10px',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.9rem', color: '#0369a1', fontWeight: '600' }}>Crédito Wepi Wallet:</span>
                    <span style={{ fontSize: '1rem', color: '#0369a1', fontWeight: '800' }}>
                      {walletBalance === null ? 'Cargando...' : `$${(walletBalance || 0).toLocaleString()}`}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary btn-full" onClick={() => setModal('editProfile')}>✍️  Editar perfil</button>
                  <button className="btn btn-secondary btn-full" onClick={() => setModal('editAddress')}>📍 Cambiar dirección</button>
                  <button className="btn btn-secondary btn-full" onClick={() => navigate('/mis-pedidos')}>📦 Mis Pedidos</button>
                  <button className="btn btn-ghost btn-full" onClick={() => { doLogout(); setModal(null); toast.success('Sesión cerrada'); }}>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}

            {modal === 'editProfile' && user && (
              <form onSubmit={handleEditProfile}>
                <h2>Editar Perfil</h2>
                <label className="form-label">Nombre completo</label>
                <input name="nombre" className="form-input" defaultValue={user.name} required />
                <label className="form-label">Email</label>
                <input name="email" type="email" className="form-input" defaultValue={user.email} required />
                <label className="form-label">Teléfono</label>
                <div className="phone-input-group">
                  <select name="prefix" className="phone-prefix-select" defaultValue={user.telefono?.startsWith('+55') ? '+55' : '+54'}>
                    <option value="+54">🇦🇷 +54</option>
                    <option value="+55">🇧🇷 +55</option>
                  </select>
                  <input 
                    name="telefono" 
                    type="tel" 
                    className="form-input phone-number-input" 
                    defaultValue={user.telefono ? user.telefono.replace(/^\+54|^\+55/, '') : ''} 
                    placeholder="Número (ej: 1123456789)" 
                    required 
                  />
                </div>
                <label className="form-label">Nueva contraseña (opcional)</label>
                <input name="newPassword" type="password" className="form-input" placeholder="Dejar en blanco si no deseas cambiarla" />
                <button type="submit" className="btn btn-primary btn-full" disabled={authLoading}>
                  {authLoading ? <span className="spinner spinner-white" /> : 'Guardar cambios'}
                </button>
              </form>
            )}

            {modal === 'editAddress' && (
              <div>
                <h2>Cambiar Mi Dirección</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginBottom: '16px' }}>
                  Seleccioná tu ubicación predeterminada en el mapa para futuras compras.
                </p>
                <button 
                  className="btn btn-primary btn-full" 
                  onClick={() => setShowProfileAddressSelector(true)}
                >
                  📍 Abrir Mapa de Dirección
                </button>
                <p style={{ marginTop: '12px', fontSize: '0.85rem' }}>
                  <strong>Actual:</strong> {user?.address || 'No configurada'}
                </p>
              </div>
            )}
            {modal === 'terms' && (
              <div>
                <h2>Términos y Condiciones y Política de Privacidad</h2>
                <div style={{ fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.5, maxHeight: '350px', overflowY: 'auto', paddingRight: '10px', textAlign: 'left' }}>
                  <h3 style={{ color: 'var(--red-600)', marginTop: 0 }}>📄 1. USUARIOS – TÉRMINOS Y CONDICIONES</h3>
                  <p><strong>1. Naturaleza del servicio</strong></p>
                  <p>Wepi es una plataforma que Intermedia entre usuarios y comercios, facilita la gestión de pedidos y coordina la logística de entrega. Wepi no elabora ni comercializa productos.</p>
                  <p><strong>2. Relación contractual</strong></p>
                  <p>El usuario acepta que la compra es con el comercio, la entrega es realizada por repartidores independientes, y Wepi no es parte directa de dichas relaciones.</p>
                  <p><strong>3. Productos</strong></p>
                  <p>Los comercios son los únicos responsables de Calidad, Ingredientes, Higiene y Estado. Wepi no garantiza los productos.</p>
                  <p><strong>4. Entregas</strong></p>
                  <p>Wepi coordina entregas mediante repartidores independientes. El usuario acepta que los tiempos son estimados, pueden existir demoras y existen riesgos inherentes a la logística.</p>
                  <p><strong>5. Limitación de responsabilidad</strong></p>
                  <p>Wepi no será responsable por intoxicaciones, problemas de salud, daños derivados del producto, demoras razonables o fallas de terceros.</p>
                  <p><strong>6. Pagos</strong></p>
                  <p>Los pagos se procesan mediante Mercado Pago. Wepi no es entidad financiera, no fija precios y puede aplicar comisiones.</p>
                  <p><strong>7. Cancelaciones</strong></p>
                  <p>Dependen del comercio y estado del pedido.</p>
                  <p><strong>8. Indemnidad</strong></p>
                  <p>El usuario mantiene indemne a Wepi ante reclamos derivados del uso.</p>
                  <p><strong>9. Aceptación</strong></p>
                  <p>Mediante registro y confirmación electrónica.</p>
                  <hr style={{ margin: '15px 0', borderColor: '#eee' }} />
                  <h3 style={{ color: 'var(--red-600)' }}>🔒 USUARIOS – POLÍTICA DE PRIVACIDAD</h3>
                  <p><strong>Datos recolectados:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Nombre, teléfono, email</li>
                    <li>Dirección</li>
                    <li>Ubicación en tiempo real</li>
                    <li>Historial de pedidos</li>
                  </ul>
                  <p><strong>Uso de datos:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Procesar pedidos</li>
                    <li>Coordinar entregas</li>
                    <li>Asignar repartidores</li>
                  </ul>
                  <p><strong>Compartición:</strong></p>
                  <ul style={{ paddingLeft: '18px', marginBottom: '10px' }}>
                    <li>Comercios</li>
                    <li>Repartidores</li>
                    <li>Proveedores de pago (Mercado Pago)</li>
                  </ul>
                </div>
                <button className="btn btn-secondary btn-full" onClick={() => setModal('register')} style={{ marginTop: 16 }}>Volver al Registro</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ——— Ice Cream Modal ——— */}
      {iceCreamModal && (
        <div className="modal-overlay" onClick={() => setIceCreamModal(null)}>
          <div className="modal-box animate-scale-in" style={{ maxWidth: 500, padding: '20px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIceCreamModal(null)}>✕</button>
            <h2 style={{ color: 'var(--red-600)', marginBottom: 8, fontSize: '1.4rem' }}>{iceCreamModal.nombre}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray-500)', marginBottom: 16 }}>{iceCreamModal.descripcion}</p>
            
            <h3 style={{ fontSize: '1rem', marginBottom: 10, fontWeight: '700' }}>1. Elegí el tamaño:</h3>
            <div className="size-selector" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {Object.keys(JSON.parse(iceCreamModal.variantes).precios).map(size => (
                <div 
                  key={size}
                  className={`selection-card ${selectedSize === size ? 'active' : ''}`}
                  onClick={() => { setSelectedSize(size); setSelectedFlavors([]); }}
                  style={{ 
                    padding: '16px 8px', borderRadius: '12px', border: selectedSize === size ? '2px solid var(--red-500)' : '2px solid #eee',
                    backgroundColor: selectedSize === size ? '#fff5f5' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease',
                    boxShadow: selectedSize === size ? '0 4px 12px rgba(220, 38, 38, 0.1)' : 'none'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: selectedSize === size ? 'var(--red-600)' : 'inherit' }}>{size}</div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.72rem', marginTop: '2px' }}>
                    ${JSON.parse(iceCreamModal.variantes).precios[size].precio}
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>
               2. Seleccioná tus sabores:
               <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontWeight: '400', marginTop: '2px' }}>
                Máximo {JSON.parse(iceCreamModal.variantes).precios[selectedSize].max} sabores
               </div>
            </h3>
            
            <div className="flavors-list" style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20, padding: '4px' }}>
              {iceCreamFlavors.map(flavor => {
                const isSelected = selectedFlavors.includes(flavor.nombre);
                const max = JSON.parse(iceCreamModal.variantes).precios[selectedSize].max;
                const canSelect = selectedFlavors.length < max;
                
                return (
                  <button 
                    key={flavor.id}
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ 
                      justifyContent: 'flex-start', textAlign: 'left', minHeight: 40, borderRadius: '10px',
                      borderWidth: isSelected ? '2px' : '1px', fontSize: '0.75rem', padding: '4px 8px'
                    }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFlavors(prev => prev.filter(f => f !== flavor.nombre));
                      } else if (canSelect) {
                        setSelectedFlavors(prev => [...prev, flavor.nombre]);
                      } else {
                        toast.error(`Máximo ${max} sabores para este tamaño`);
                      }
                    }}
                  >
                    {flavor.nombre}
                    {isSelected && <span style={{ marginLeft: 'auto' }}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Sección de Salsas Forzada */}
            {(iceCreamModal.salsasDisponibles || []).length > 0 && (
              <div style={{ background: '#fff9f0', padding: '12px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #ffe4bc' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 10, fontWeight: '700', color: '#b45309' }}>
                  🍯 ¿Querés agregar salsas?
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(iceCreamModal.salsasDisponibles || []).map(sauce => {
                    const isSelected = selectedSauces.includes(sauce.nombre);
                    return (
                      <button 
                        key={sauce.id}
                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                        style={{ borderRadius: '20px', padding: '4px 10px', fontSize: '0.72rem' }}
                        onClick={() => {
                          if (isSelected) setSelectedSauces(prev => prev.filter(s => s !== sauce.nombre));
                          else setSelectedSauces(prev => [...prev, sauce.nombre]);
                        }}
                      >
                        {sauce.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {iceCreamExtras.length > 0 && (
              <>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>{(iceCreamModal.salsasDisponibles || []).length > 0 ? '4' : '3'}. Adicionales <small style={{ fontWeight: '400', color: 'var(--gray-500)' }}>(Opcional)</small></h3>
                <div className="extras-list" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                  {iceCreamExtras.map(extra => {
                    const isSelected = selectedExtras.some(e => e.id === extra.id);
                    return (
                      <button 
                        key={extra.id}
                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                        style={{ borderRadius: '20px', padding: '6px 14px' }}
                        onClick={() => {
                          if (isSelected) setSelectedExtras(prev => prev.filter(e => e.id !== extra.id));
                          else setSelectedExtras(prev => [...prev, extra]);
                        }}
                      >
                        {extra.nombre} (+${extra.precio})
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {(() => {
              const configuration = JSON.parse(iceCreamModal.variantes);
              const basePrice = parseFloat(configuration.precios[selectedSize].precio || 0);
              const extrasPrice = selectedExtras.reduce((sum, e) => sum + parseFloat(e.precio || 0), 0);
              const rawTotal = basePrice + extrasPrice;
              const currentTotal = calculateDiscountedPrice({ ...iceCreamModal, precio: rawTotal });
              const hasDiscount = currentTotal < rawTotal;

              return (
                <button 
                  className="btn btn-primary btn-full btn-lg"
                  disabled={selectedFlavors.length === 0}
                  style={{ borderRadius: '12px', height: '56px', fontSize: '1.1rem' }}
                  onClick={() => {
                    const details = [];
                    details.push(`Sabores: ${selectedFlavors.join(', ')}`);
                    if (selectedSauces.length > 0) details.push(`Salsas: ${selectedSauces.join(', ')}`);
                    if (selectedExtras.length > 0) details.push(`Extras: ${selectedExtras.map(e => e.nombre).join(', ')}`);

                    const finalItem = {
                      ...iceCreamModal,
                      menuId: iceCreamModal.id,
                      id: `${iceCreamModal.id}-${selectedSize}-${Date.now()}`,
                      nombre: `${iceCreamModal.nombre} ${selectedSize}`,
                      precioOriginal: rawTotal,
                      precio: currentTotal,
                      flavors: selectedFlavors,
                      sauces: selectedSauces,
                      extras: selectedExtras,
                      descripcion: details.join(' | ')
                    };
                    cart.addItem(finalItem);
                    setIceCreamModal(null);
                    toast.success('¡Helado agregado!');
                  }}
                >
                  Agregar • {hasDiscount && <span style={{ textDecoration: 'line-through', opacity: 0.7, fontSize: '0.95rem', marginRight: '8px' }}>${rawTotal}</span>} ${currentTotal}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {burgerModal && (
        <div className="modal-overlay" onClick={() => setBurgerModal(null)}>
          <div className="modal-box animate-scale-in" style={{ maxWidth: 500, padding: '24px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBurgerModal(null)}>✕</button>
            <h2 style={{ color: 'var(--red-600)', marginBottom: 8, fontSize: '1.5rem' }}>{burgerModal.nombre}</h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--gray-500)', marginBottom: 24 }}>{burgerModal.descripcion}</p>
            
            {(() => {
              const cfg = JSON.parse(burgerModal.variantes);
              const baseVariantPrice = Number(selectedVariant?.precio || burgerModal.precio);
              const extrasPriceTotal = selectedBurgerExtras.reduce((sum, e) => sum + Number(e.precio || 0), 0);
              const friesPrice = withFries ? Number(cfg.precio_papas || 0) : 0;
              const rawTotal = baseVariantPrice + extrasPriceTotal + friesPrice;
              const totalCalculated = calculateDiscountedPrice({ ...burgerModal, precio: rawTotal });
              const hasDiscount = totalCalculated < rawTotal;

              return (
                <>
                  {cfg.variants?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>1. Seleccioná la opción:</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {cfg.variants.map((v, i) => (
                          <div 
                            key={i}
                            className={`selection-card ${selectedVariant?.nombre === v.nombre ? 'active' : ''}`}
                            onClick={() => setSelectedVariant(v)}
                            style={{ 
                              padding: '12px 6px', borderRadius: '12px', border: selectedVariant?.nombre === v.nombre ? '2px solid var(--red-500)' : '1px solid #eee',
                              backgroundColor: selectedVariant?.nombre === v.nombre ? '#fff5f5' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{v.nombre}</div>
                            <div style={{ color: 'var(--red-600)', fontWeight: '700', fontSize: '0.85rem', marginTop: '4px' }}>${v.precio}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cfg.extras?.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>2. Adicionales:</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {cfg.extras.map((ex, i) => {
                          const isIncluded = selectedBurgerExtras.some(e => e.nombre === ex.nombre);
                          return (
                            <button 
                              key={i}
                              className={`btn btn-xs ${isIncluded ? 'btn-primary' : 'btn-outline'}`}
                              style={{ borderRadius: '20px', padding: '6px 14px' }}
                              onClick={() => {
                                if (isIncluded) setSelectedBurgerExtras(prev => prev.filter(e => e.nombre !== ex.nombre));
                                else setSelectedBurgerExtras(prev => [...prev, ex]);
                              }}
                            >
                              {ex.nombre} (+${ex.precio})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {cfg.con_papas && (
                    <div style={{ marginBottom: 28 }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: 12, fontWeight: '700' }}>3. ¿Lo hacemos COMBO?</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div 
                          className={`selection-card ${withFries ? 'active' : ''}`}
                          onClick={() => setWithFries(true)}
                          style={{ 
                            padding: '20px 10px', borderRadius: '12px', border: withFries ? '2px solid var(--red-500)' : '1px solid #eee',
                            backgroundColor: withFries ? '#fff5f5' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                            boxShadow: withFries ? '0 4px 12px rgba(220, 38, 38, 0.1)' : 'none'
                          }}
                        >
                          <div style={{ fontSize: '2.5rem' }}>🍟</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>¡Si, papas!</div>
                            <div style={{ color: 'var(--red-600)', fontWeight: '800', fontSize: '0.9rem' }}>+ ${cfg.precio_papas}</div>
                          </div>
                        </div>

                        <div 
                          className={`selection-card ${!withFries ? 'active' : ''}`}
                          onClick={() => setWithFries(false)}
                          style={{ 
                            padding: '20px 10px', borderRadius: '12px', border: !withFries ? '2px solid var(--gray-600)' : '1px solid #eee',
                            backgroundColor: !withFries ? '#f9fafb' : '#fff', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                            opacity: !withFries ? 1 : 0.7
                          }}
                        >
                          <div style={{ fontSize: '2.5rem' }}>{cfg.es_pancho ? '🌭' : '🍔'}</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: '700', fontSize: '1rem' }}>Solo el {cfg.es_pancho ? 'pancho' : 'plato'}</div>
                            <div style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>Sin papas</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button 
                    className="btn btn-primary btn-full btn-lg"
                    style={{ borderRadius: '12px', height: '56px', fontSize: '1.1rem' }}
                    onClick={() => {
                      const variantText = selectedVariant ? `${selectedVariant.nombre}` : '';
                      const extrasText = selectedBurgerExtras.map(e => e.nombre).join(' + ');
                      const friesText = withFries ? ' + PAPAS' : '';
                      
                      let finalName = burgerModal.nombre;
                      if (variantText) finalName += ` ${variantText}`;
                      if (extrasText) finalName += ` c/ ${extrasText}`;
                      finalName += friesText;

                      const finalItem = {
                        ...burgerModal,
                        menuId: burgerModal.id,
                        id: `${burgerModal.id}-${Date.now()}`,
                        nombre: finalName,
                        precioOriginal: rawTotal,
                        precio: totalCalculated,
                        variant: selectedVariant,
                        burgerExtras: selectedBurgerExtras,
                        withFries: withFries
                      };
                      cart.addItem(finalItem);
                      setBurgerModal(null);
                      toast.success(`¡Agregado al carrito!`);
                    }}
                  >
                    Agregar • {hasDiscount && <span style={{ textDecoration: 'line-through', opacity: 0.7, fontSize: '0.95rem', marginRight: '8px' }}>${rawTotal}</span>} ${totalCalculated}
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}



      <footer className="footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
        <img src="https://i.postimg.cc/htHr0QMM/Tarde-de-superclasico-(1)-(1).png" alt="Wepi" style={{ height: '80px', objectFit: 'contain' }} />
        <p>© 2026 <strong>Wepi</strong> — Plataforma de Pedidos y Delivery</p>
        <p>
          <Link to="/locales">Registrá tu local</Link> •{' '}
          <button className="footer-link" style={{ color: 'white' }} onClick={() => setModal('terms')}>Términos</button> •{' '}
          <a href="mailto:bajoneando.st@gmail.com">Soporte</a> •{' '}
          <button 
            className="footer-link" 
            style={{ color: 'white', fontWeight: 'bold' }} 
            onClick={() => setShowRegretModal(true)}
          >
            Botón de Arrepentimiento
          </button>
        </p>
      </footer>

      {/* Regret Modal */}
      {showRegretModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowRegretModal(false)}>
          <div className="modal-box animate-fade-in" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--red-600)', marginBottom: '16px' }}>Botón de Arrepentimiento</h3>
            <p style={{ marginBottom: '20px', color: 'var(--gray-600)', fontSize: '0.95rem' }}>
              ¿Deseas arrepentirte de tu registro y eliminar tu cuenta permanentemente de Wepi? <br/>
              <strong>Esta acción no se puede deshacer.</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className="btn btn-primary" 
                style={{ background: 'var(--red-600)' }} 
                disabled={deleting}
                onClick={async () => {
                  if (!user?.userId) {
                    toast.error("Debes iniciar sesión para eliminar tu cuenta.");
                    setShowRegretModal(false);
                    return;
                  }
                  setDeleting(true);
                  try {
                    await api.deleteUsuarioAccount(user.userId);
                    toast.success("Cuenta eliminada correctamente.");
                    doLogout();
                    window.location.href = "/";
                  } catch (e) {
                    toast.error("No se pudo eliminar la cuenta. Es posible que tengas pedidos activos.");
                  } finally {
                    setDeleting(false);
                    setShowRegretModal(false);
                  }
                }}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar mi registro'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowRegretModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* â”€â”€â”€ Address Selector Modals â”€â”€â”€ */}
      {showAddressSelector && (
        <AddressSelector
          isLoaded={isMapLoaded}
          initialAddress={addressData.address}
          initialCoords={addressData.lat ? { lat: addressData.lat, lng: addressData.lng } : null}
          onConfirm={(data) => {
            setAddressData(data);
            setShowAddressSelector(false);
          }}
          onCancel={() => setShowAddressSelector(false)}
        />
      )}

      {showProfileAddressSelector && (
        <AddressSelector
          isLoaded={isMapLoaded}
          initialAddress={user?.direccion || ''}
          initialCoords={user?.lat ? { lat: user.lat, lng: user.lng } : null}
          onConfirm={async (data) => {
            try {
              await api.updateDireccion(user.id, data.address, data.lat, data.lng);
              updateUserAddress(data.address);
              // Podríamos necesitar recargar el usuario localmente o actualizar el context
              toast.success('Dirección de perfil actualizada');
              setShowProfileAddressSelector(false);
              setModal('profile');
            } catch (e) {
              toast.error('Error al actualizar perfil');
            }
          }}
          onCancel={() => setShowProfileAddressSelector(false)}
        />
      )}

      {/* Modal de Búsqueda de Repartidor */}
      {searchingDriver && (
        <div className="searching-modal-overlay">
          <div className="searching-modal-card">
            {!foundDriver ? (
              <>
                <div className="searching-animation">
                  <div className="radar"></div>
                  <img src="https://i.postimg.cc/QCcjwFRf/18611-(1).png" alt="Buscando" className="moving-moto" />
                </div>
                <h2>Confirmando pedido...</h2>
                <div className="searching-status-pill">
                  {searchSeconds < 10 ? 'Iniciando búsqueda...' : 
                   searchSeconds < 30 ? 'Notificando a repartidores cercanos...' :
                   searchSeconds < 60 ? 'Estamos esperando una aceptación...' :
                   'Ampliando zona de búsqueda...'}
                </div>
                <p className="searching-description">
                  Estamos buscando al mejor repartidor disponible para llevar tu pedido. Esto puede demorar unos minutos.
                </p>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  marginTop: '10px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>âš ï¸</span> 
                  <span><strong>NO CIERRES ESTA VENTANA:</strong> Una vez que encontremos repartidor, deberás realizar el pago para confirmar tu pedido.</span>
                </div>
                <div className="searching-timer">
                  Buscando repartidor... 
                  <span style={{ fontWeight: 800, color: 'var(--red-600)', marginLeft: '8px', fontSize: '1.1rem' }}>
                    0{Math.floor((60 - searchSeconds) / 60)}:{( (60 - searchSeconds) % 60 ).toString().padStart(2, '0')}
                  </span>
                </div>
                <button 
                  className="searching-cancel-btn"
                  onClick={async () => {
                    const orderIdToCancel = pendingOrderId;
                    setSearchingDriver(false);
                    setPendingOrderId(null);
                    localStorage.removeItem('pendingOrderDataPruebas');
                    
                    if (orderIdToCancel) {
                      try {
                        await Promise.all([
                          api.supabase.from('pedidos_general').update({ estado: 'Rechazado' }).eq('id', orderIdToCancel),
                          api.supabase.from('pedidos_locales').update({ estado: 'Rechazado' }).eq('pedido_id', orderIdToCancel)
                        ]);
                        toast.success('Búsqueda cancelada');
                      } catch (e) {
                        console.error("Error cancelling order:", e);
                      }
                    }
                  }}
                >
                  Cancelar búsqueda
                </button>
              </>
            ) : (
              <div className="found-driver-animation">
                <div className="success-check">
                  <span className="check-icon">ðŸš€</span>
                </div>
                <h2>¡Repartidor encontrado!</h2>
                <p className="success-msg">Ya encontramos un repartidor para llevar tu pedido.</p>
                
                <div className="found-driver-info">
                  <img src={foundDriver.foto_url || 'https://i.postimg.cc/1RWxRcKM/18611-(1)-(1).png'} alt={foundDriver.nombre} className="driver-img" />
                  <div className="driver-details">
                    <span className="driver-name">{foundDriver.nombre}</span>
                    <span className="estimated-tag">Llega en {estimatedTime}</span>
                  </div>
                </div>

                <div className="opening-mp">
                  <div className="spinner-small"></div>
                  <span>Abriendo checkout de Mercado Pago...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {driverSearchTimeout && (
        <div className="searching-modal-overlay">
          <div className="searching-modal-card animate-slide-up">
            <div className="timeout-icon">ðŸ“£</div>
            <h2>Seguimos buscando...</h2>
            <p>Los repartidores están un poco ocupados en este momento. ¿Quieres seguir esperando un poco más? Seguiremos notificándolos.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '20px' }}>
              <button 
                className="btn btn-primary btn-full"
                onClick={() => {
                  setDriverSearchTimeout(false);
                  setSearchSeconds(0); 
                  api.broadcastOrderToDrivers(pendingOrderId, cart.total, cart.items[0]?.local_id);
                  toast.success('¡Enviamos otro aviso a los repartidores! 🛵');
                }}
              >
                âœ… Sí, seguir esperando
              </button>
              <button 
                className="btn btn-outline btn-full"
                onClick={async () => {
                  const orderIdToCancel = pendingOrderId;
                  setDriverSearchTimeout(false);
                  setSearchingDriver(false);
                  setPendingOrderId(null);
                  localStorage.removeItem('pendingOrderDataPruebas');
                  
                  if (orderIdToCancel) {
                    try {
                      await Promise.all([
                        api.supabase.from('pedidos_general').update({ estado: 'Rechazado' }).eq('id', orderIdToCancel),
                        api.supabase.from('pedidos_locales').update({ estado: 'Rechazado' }).eq('pedido_id', orderIdToCancel)
                      ]);
                      toast.success('Búsqueda cancelada');
                    } catch (e) {
                      console.error("Error cancelling order:", e);
                    }
                  }
                }}
              >
                âœ– No, cancelar pedido
              </button>
           </div>
          </div>
        </div>
      )}

      {/* Chatbot de Ayuda */}
      <HelpChatbot />
    </div>
  );
}
