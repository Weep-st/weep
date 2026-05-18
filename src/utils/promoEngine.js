/**
 * PromoEngine.js — Motor de validación y cálculo de promociones para Wepi
 * Maneja Créditos, Envíos, Cupones, Combos y Ofertas Diarias.
 */

export const evaluatePromotions = (context) => {
    const { cart, user, promotions, currentLocalId } = context;
    
    // 1. Resultados base
    let results = {
        appliedPromos: [],
        discountTotal: 0,
        shippingDiscount: 0,
        potentialCashback: 0,
        freeShipping: false,
        messages: []
    };

    if (!promotions || promotions.length === 0) return results;

    const subtotal = cart.totalPrice || 0;
    
    // Obtener día actual en Argentina (0-6, donde 0 es Domingo)
    const today = (() => {
        const dateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'narrow' });
        // narrow returns 'S', 'M', 'T', 'W', 'T', 'F', 'S' ... not helpful for index.
        // Let's use numeric day
        const dayStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric' }); // No, this is day of month.
        
        // Better:
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short' });
        const shortDay = formatter.format(new Date()); // 'Mon', 'Tue', etc.
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.indexOf(shortDay);
    })();

    // Determinación robusta de si es el primer pedido
    const hasOrdered = user?.ya_realizo_pedidos === true || 
                       user?.ya_realizo_pedidos === 'true' || 
                       user?.ya_realizo_pedidos === 1 || 
                       user?.ya_realizo_pedidos === '1' ||
                       user?.ya_realizo_pedidos === 'TRUE' ||
                       (context.orderCount !== undefined && context.orderCount > 0);
    
    const isFirstOrder = !user || !user.id || !hasOrdered;

    // 2. Filtrar promos que podrían aplicar
    const activePromos = promotions.filter(promo => {
        if (!promo.activo) return false;
        
        const triggers = promo.triggers || {};
        
        // Trigger: Local específico o Global
        const isGlobal = triggers.global === true || triggers.global === 'true';
        const localIds = Array.isArray(triggers.local_ids) ? triggers.local_ids : [];
        const hasSpecificLocals = localIds.length > 0 && !localIds.includes('global');
        const matchesLocal = localIds.includes(currentLocalId);

        // Si tiene locales específicos, debe coincidir con uno
        if (hasSpecificLocals && !matchesLocal) return false;
        
        // Si no es global y no coincide el local, no aplica
        if (!isGlobal && !matchesLocal) return false;

        // Trigger: Primera Compra (RESTRICCIÓN INDIVIDUAL)
        const isFirstOrderOnly = triggers.primera_compra === true || triggers.primera_compra === 'true';
        if (isFirstOrderOnly && !isFirstOrder) {
            console.log(`[PromoEngine] Promo ${promo.nombre} (${promo.id}) FILTRADA: Solo 1er pedido y usuario ya pidió.`);
            return false;
        }

        // Trigger: Límite de uso por usuario (Módulo E)
        const limites = promo.limites || {};
        if (limites.uso_por_usuario > 0 && context.userPromoUsage) {
            const usage = context.userPromoUsage[promo.id] || 0;
            if (usage >= limites.uso_por_usuario) {
                console.log(`[PromoEngine] Promo ${promo.nombre} FILTRADA: Límite de uso alcanzado (${usage}/${limites.uso_por_usuario}).`);
                return false;
            }
        }

        // Trigger: Días de la semana
        if (triggers.dias_semana && !triggers.dias_semana.includes(today)) return false;

        // Trigger: Compra mínima para ACTIVAR
        if (triggers.min_compra && subtotal < triggers.min_compra) return false;

        // Trigger: Fecha específica
        if (triggers.fecha_especifica && triggers.fecha_especifica.trim() !== "") {
            const todayStr = new Date().toISOString().split('T')[0];
            if (triggers.fecha_especifica !== todayStr) return false;
        }

        // Trigger: Categorías (Mínimo un producto de la categoría)
        if (triggers.categorias && triggers.categorias.length > 0) {
            const hasItemsInCategories = cart.items?.some(item => 
                triggers.categorias.some(c => c.toLowerCase() === (item.categoria || "").toLowerCase())
            );
            if (!hasItemsInCategories) return false;
        }
        
        // Trigger: Método de Pago (Módulo F)
        if (triggers.metodo_pago && triggers.metodo_pago !== 'todos') {
            const currentMethod = context.cart?.metodoPago;
            const isBadgeMode = !context.cart?.items || context.cart?.items.length === 0;
            
            // En el checkout (con items), forzamos coincidencia.
            if (!isBadgeMode && currentMethod && currentMethod !== triggers.metodo_pago) {
                return false;
            }
        }

        // Trigger: Código de Cupón
        if (promo.tipo === 'cupon') {
            const requiredCode = (triggers.codigo_cupon || '').toUpperCase().trim();
            const inputCode = (context.cart?.couponCode || '').toUpperCase().trim();
            
            // Si la promo exige un código y el usuario no puso el correcto, no aplica
            if (requiredCode && requiredCode !== inputCode) return false;
            
            // Si es un cupón, requiere que el usuario haya intentado aplicar el código correcto
            if (!inputCode) return false;
        }

        return true;
    });

    // Ordenar por prioridad (descendente)
    activePromos.sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0));

    // 3. Evaluar Requisitos y aplicar beneficios
    let hasNonStackable = false;

    activePromos.forEach(promo => {
        if (hasNonStackable) return;

        const requisitos = promo.requisitos || {};
        const beneficios = promo.beneficios || {};
        const limites = promo.limites || {};
        const triggers = promo.triggers || {};

        // Requisito: Compra mínima para USAR el beneficio
        if (requisitos.min_compra_uso && subtotal < requisitos.min_compra_uso) return;

        if (requisitos.fecha_expiracion) {
            const expDate = new Date(requisitos.fecha_expiracion);
            if (new Date() > expDate) return;
        }

        // Requisito: Método de Pago para USO
        if (requisitos.metodo_pago && requisitos.metodo_pago !== 'todos') {
            if (cart.metodoPago && cart.metodoPago !== requisitos.metodo_pago) return;
        }

        // Determinar subtotal aplicable a esta promo (específico por categoría si aplica)
        let applicableSubtotal = subtotal;
        if (triggers.categorias && triggers.categorias.length > 0) {
            applicableSubtotal = cart.items
                ?.filter(item => triggers.categorias.some(c => c.toLowerCase() === (item.categoria || "").toLowerCase()))
                ?.reduce((sum, item) => sum + (Number(item.precio) * (item.cantidad || item.qty || 1)), 0) || 0;
            
            if (applicableSubtotal === 0) return;
        }

        // Aplicar según tipo
        let applied = false;

        switch (promo.tipo) {
            case 'credito':
                // Cashback (no descuenta del total actual, se gana para después)
                let cashback = 0;
                if (beneficios.tipo_beneficio === 'porcentaje') {
                    cashback = Math.round(applicableSubtotal * (beneficios.valor / 100));
                } else if (beneficios.tipo_beneficio === 'fijo') {
                    cashback = beneficios.valor;
                }
                
                // Aplicar tope específico del beneficio
                if (beneficios.tope_valor > 0 && cashback > beneficios.tope_valor) {
                    cashback = beneficios.tope_valor;
                }
                
                // NOTA: No aplicamos tope_max_descuento aquí porque ese tope es para el USO del crédito en el checkout,
                // no para la generación del mismo. La generación se rige por el valor del beneficio y su tope_valor.

                results.potentialCashback += cashback;
                applied = true;
                break;

            case 'envio':
                if (beneficios.tipo_beneficio === 'envio_gratis') {
                    results.freeShipping = true;
                    results.shippingDiscount = cart.deliveryFee || 0;
                } else if (beneficios.tipo_beneficio === 'envio_fijo') {
                    results.shippingDiscount = Math.max(0, (cart.deliveryFee || 0) - beneficios.valor);
                } else if (beneficios.tipo_beneficio === 'porcentaje') {
                    results.shippingDiscount = Math.round((cart.deliveryFee || 0) * (beneficios.valor / 100));
                    // Aplicar tope específico del beneficio
                    if (beneficios.tope_valor > 0 && results.shippingDiscount > beneficios.tope_valor) {
                        results.shippingDiscount = beneficios.tope_valor;
                    }
                }
                applied = true;
                break;

            case 'cupon':
            case 'diario':
            case 'combo':
                let discount = 0;
                if (beneficios.tipo_beneficio === 'porcentaje') {
                    discount = Math.round(applicableSubtotal * (beneficios.valor / 100));
                } else if (beneficios.tipo_beneficio === 'fijo') {
                    discount = beneficios.valor;
                }

                // Aplicar tope específico del beneficio
                if (beneficios.tope_valor > 0 && discount > beneficios.tope_valor) {
                    discount = beneficios.tope_valor;
                }

                // Aplicar tope de descuento
                if (requisitos.tope_max_descuento && discount > requisitos.tope_max_descuento) {
                    discount = requisitos.tope_max_descuento;
                }

                // Validar porcentaje máximo de uso (si aplica)
                if (requisitos.max_porcentaje_uso) {
                    const maxAllowed = Math.round(applicableSubtotal * (requisitos.max_porcentaje_uso / 100));
                    if (discount > maxAllowed) discount = maxAllowed;
                }

                results.discountTotal += discount;
                applied = true;
                break;
        }

        if (applied) {
            results.appliedPromos.push({
                id: promo.id,
                nombre: promo.nombre,
                tipo: promo.tipo,
                beneficio: beneficios,
                triggers: triggers,
                requisitos: requisitos
            });
            
            if (!limites.acumulable) {
                hasNonStackable = true;
            }
        }
    });

    return results;
};
