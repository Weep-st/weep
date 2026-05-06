-- Habilitar acceso de repartidores a sus propios cierres/liquidaciones
-- Esto permite que los repartidores vean cierres donde su ID está en el JSONB detalles_por_repartidor

DROP POLICY IF EXISTS "Repartidores pueden ver cierres donde participaron" ON cierre_repartidores;

CREATE POLICY "Repartidores pueden ver cierres donde participaron" ON cierre_repartidores
    FOR SELECT USING (
        detalles_por_repartidor @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text))
    );

-- Nota: auth.uid()::text debe coincidir con el formato 'REP-XXXX' usado en la tabla repartidores.
