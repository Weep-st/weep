-- Insertar valor por defecto para Bebidas en rubros_config
INSERT INTO public.rubros_config (nombre, nivel_rapidez, ventana_stacking_minutos)
VALUES ('Bebidas', 1, 5)
ON CONFLICT (nombre) DO UPDATE 
SET nivel_rapidez = EXCLUDED.nivel_rapidez, 
    ventana_stacking_minutos = EXCLUDED.ventana_stacking_minutos;
