-- Eliminar la clave foránea vieja que apuntaba a la tabla antigua de cupones
ALTER TABLE public.pedidos_general 
DROP CONSTRAINT IF EXISTS pedidos_general_cupon_id_fkey;

-- Crear la nueva clave foránea apuntando a la tabla unificada de promociones
ALTER TABLE public.pedidos_general 
ADD CONSTRAINT pedidos_general_cupon_id_fkey 
FOREIGN KEY (cupon_id) 
REFERENCES public.promociones(id) 
ON DELETE SET NULL;
