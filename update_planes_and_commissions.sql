-- ═══════════════════════════════════════════════════
-- UPDATE PLANS AND COMMISSIONS LOGIC
-- ═══════════════════════════════════════════════════

-- 1. Rename existing plans
UPDATE public.planes_config SET nombre = 'Visible' WHERE nombre = 'Freemium';
UPDATE public.planes_config SET nombre = 'Recomendado' WHERE nombre = 'Plus';
UPDATE public.planes_config SET nombre = 'Destacado' WHERE nombre = 'Pro';

-- 2. Clean old levels
DELETE FROM public.planes_niveles;

-- 3. Insert new levels for all plans
-- Levels: 
-- 1: 0-15 pedidos -> 15% (Despegue)
-- 2: 15-30 pedidos -> 12% (Crecimiento)
-- 3: 30-50 pedidos -> 10% (Experto en ventas)
-- 4: 50+ pedidos -> 8% (Nivel pro)

INSERT INTO public.planes_niveles (plan_id, nivel, comision_porcentaje, threshold_pedidos, threshold_facturacion)
SELECT id, 1, 15, 0, 0 FROM public.planes_config UNION ALL
SELECT id, 2, 12, 15, 9999999 FROM public.planes_config UNION ALL
SELECT id, 3, 10, 30, 9999999 FROM public.planes_config UNION ALL
SELECT id, 4, 8, 50, 9999999 FROM public.planes_config;

-- 4. Update metrics for active month if necessary (to refresh cached level_actual)
-- This will be automatically recalculated by get_current_commission_info when called,
-- but we can update the cached value in local_metricas_mensuales if it exists.
UPDATE public.local_metricas_mensuales
SET nivel_actual = 1 -- Reset or let it update on next sale
WHERE mes = extract(month from now()) AND anio = extract(year from now());
