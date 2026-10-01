-- Función que se ejecutará al borrar un repartidor
CREATE OR REPLACE FUNCTION public.delete_auth_user_on_repartidor_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con privilegios elevados para poder acceder al esquema 'auth'
AS $$
BEGIN
    -- Verificar si el repartidor tenía un auth_id vinculado
    IF OLD.auth_id IS NOT NULL THEN
        -- Borrar el usuario correspondiente de la tabla de autenticación
        DELETE FROM auth.users WHERE id = OLD.auth_id;
    END IF;
    RETURN OLD;
END;
$$;

-- Crear el trigger que escucha los borrados en la tabla 'repartidores'
DROP TRIGGER IF EXISTS trigger_delete_repartidor_auth ON public.repartidores;
CREATE TRIGGER trigger_delete_repartidor_auth
AFTER DELETE ON public.repartidores
FOR EACH ROW
EXECUTE FUNCTION public.delete_auth_user_on_repartidor_delete();
