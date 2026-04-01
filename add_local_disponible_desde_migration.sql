-- Añadir columna disponible_desde a la tabla locales
ALTER TABLE locales
ADD COLUMN IF NOT EXISTS disponible_desde DATE;

-- Comentario descriptivo para la columna
COMMENT ON COLUMN locales.disponible_desde IS 'Indica la fecha a partir de la cual el local estará disponible para pedidos en la app de clientes';
