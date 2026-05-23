/**
 * Utility to manage business hours logic.
 * Supports both legacy columns and the new flexible config_horarios (JSONB).
 */

const DAYS_MAP = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const normalize = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

/**
 * Checks if the local is currently open based on its configuration.
 */
export const isLocalOpen = (local) => {
  if (!local) return false;

  // 1. Check availability date (legacy/shared)
  if (local.disponible_desde) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = local.disponible_desde.split('-');
    const availableDate = new Date(parts[0], parts[1] - 1, parts[2]);
    if (today < availableDate) return false;
  }

  // 2. If not in automatic mode, return manual state
  if (!local.modo_automatico) {
    return local.estado?.toLowerCase() === 'activo';
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentDayName = DAYS_MAP[now.getDay()];
  const currentDayNorm = normalize(currentDayName);

  // 3. Check new flexible configuration (config_horarios)
  if (local.config_horarios && typeof local.config_horarios === 'object' && Object.keys(local.config_horarios).length > 0) {
    const dayConfigKey = Object.keys(local.config_horarios).find(k => normalize(k) === currentDayNorm);
    const dayConfig = dayConfigKey ? local.config_horarios[dayConfigKey] : null;

    if (!dayConfig || dayConfig.tipo === 'cerrado') return false;
    if (dayConfig.tipo === '24hs') return true;

    if (dayConfig.tipo === 'especifico' && Array.isArray(dayConfig.intervalos)) {
      return dayConfig.intervalos.some(intervalo => {
        const [hI, mI] = (intervalo.inicio || '00:00').split(':').map(Number);
        const [hF, mF] = (intervalo.fin || '00:00').split(':').map(Number);
        const minInicio = hI * 60 + mI;
        const minFin = hF * 60 + mF;

        if (minInicio < minFin) {
          return currentMinutes >= minInicio && currentMinutes <= minFin;
        } else {
          return currentMinutes >= minInicio || currentMinutes <= minFin;
        }
      });
    }
  }

  // 4. Fallback to legacy columns
  const { horario_apertura, horario_cierre, horario_apertura2, horario_cierre2, dias_apertura } = local;

  if (dias_apertura && Array.isArray(dias_apertura) && dias_apertura.length > 0) {
    const normalizedDays = dias_apertura.map(normalize);
    if (!normalizedDays.includes(currentDayNorm)) return false;
  }

  if (!horario_apertura || !horario_cierre) return local.estado?.toLowerCase() === 'activo';

  const checkInterval = (start, end) => {
    if (!start || !end) return false;
    const [hI, mI] = start.split(':').map(Number);
    const [hF, mF] = end.split(':').map(Number);
    const minI = hI * 60 + mI;
    const minF = hF * 60 + mF;
    if (minI < minF) return currentMinutes >= minI && currentMinutes <= minF;
    return currentMinutes >= minI || currentMinutes <= minF;
  };

  const insideFirst = checkInterval(horario_apertura, horario_cierre);
  const insideSecond = (horario_apertura2 && horario_cierre2) ? checkInterval(horario_apertura2, horario_cierre2) : false;

  return insideFirst || insideSecond;
};

/**
 * Returns text like "abre a las 19:00" or "cierra a las 14:00"
 */
export const getNextStatusChange = (local) => {
  if (!local) return '';
  
  const isOpen = isLocalOpen(local);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentDayName = DAYS_MAP[now.getDay()];
  const currentDayNorm = normalize(currentDayName);

  // Simplified logic for "abre/cierra"
  // For better UX, we'll try to find the relevant time in the current day's config
  
  let intervals = [];

  // 1. Get intervals from config_horarios
  if (local.config_horarios && typeof local.config_horarios === 'object') {
    const dayConfigKey = Object.keys(local.config_horarios).find(k => normalize(k) === currentDayNorm);
    const dayConfig = dayConfigKey ? local.config_horarios[dayConfigKey] : null;
    if (dayConfig?.tipo === '24hs') return 'Abierto 24hs';
    if (dayConfig?.tipo === 'especifico' && Array.isArray(dayConfig.intervalos)) {
      intervals = dayConfig.intervalos;
    }
  }

  // 2. Fallback to legacy intervals
  if (intervals.length === 0 && local.horario_apertura && local.horario_cierre) {
    intervals.push({ inicio: local.horario_apertura, fin: local.horario_cierre });
    if (local.horario_apertura2 && local.horario_cierre2) {
      intervals.push({ inicio: local.horario_apertura2, fin: local.horario_cierre2 });
    }
  }

  if (isOpen) {
    // Find the interval we are currently in and return its end time
    const currentInterval = intervals.find(int => {
      const [hI, mI] = int.inicio.split(':').map(Number);
      const [hF, mF] = int.fin.split(':').map(Number);
      const minI = hI * 60 + mI;
      const minF = hF * 60 + mF;
      if (minI < minF) return currentMinutes >= minI && currentMinutes <= minF;
      return currentMinutes >= minI || currentMinutes <= minF;
    });
    if (currentInterval) return `cierra ${currentInterval.fin}`;
    return 'Abierto';
  } else {
    // Find the next interval that will open
    const nextInterval = intervals
      .map(int => {
        const [hI, mI] = int.inicio.split(':').map(Number);
        return { ...int, minI: hI * 60 + mI };
      })
      .filter(int => int.minI > currentMinutes)
      .sort((a, b) => a.minI - b.minI)[0];

    if (nextInterval) return `abre ${nextInterval.inicio}`;
    return 'Cerrado';
  }
};
