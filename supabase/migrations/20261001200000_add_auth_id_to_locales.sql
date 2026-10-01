-- 1. Add auth_id to locales table
ALTER TABLE public.locales ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Trigger to delete auth.users when a local is deleted
CREATE OR REPLACE FUNCTION public.delete_auth_user_on_local_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.auth_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = OLD.auth_id;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_delete_local_auth ON public.locales;
CREATE TRIGGER trigger_delete_local_auth
AFTER DELETE ON public.locales
FOR EACH ROW
EXECUTE FUNCTION public.delete_auth_user_on_local_delete();
