-- ═══════════════════════════════════════════════════
-- ROBUST TRIGGER UPDATE: COMMISSION TIERS IN DB
-- Sets both comision_porcentaje_aplicada/comision_monto_calculado
-- and comision_pct/comision_monto columns on pedidos_locales.
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_apply_commission_on_order()
RETURNS TRIGGER AS $$
DECLARE
    v_info JSON;
    v_comision_pct NUMERIC;
BEGIN
    -- Obtener la info de comisión actual del local
    v_info := public.get_current_commission_info(NEW.local_id);
    v_comision_pct := (v_info->>'comision_actual')::NUMERIC;
    
    -- Poblar ambas columnas para retrocompatibilidad total
    NEW.comision_porcentaje_aplicada := v_comision_pct;
    NEW.comision_monto_calculado := (NEW.total * v_comision_pct / 100.0);
    
    NEW.comision_pct := v_comision_pct;
    NEW.comision_monto := (NEW.total * v_comision_pct / 100.0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-vincular el trigger
DROP TRIGGER IF EXISTS trg_apply_commission ON public.pedidos_locales;
CREATE TRIGGER trg_apply_commission
BEFORE INSERT ON public.pedidos_locales
FOR EACH ROW
EXECUTE FUNCTION public.fn_apply_commission_on_order();
