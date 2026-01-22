-- Agregar campo sector a order_list_items
-- Ejecuta esto en Supabase SQL Editor

ALTER TABLE order_list_items 
ADD COLUMN IF NOT EXISTS sector INTEGER CHECK (sector IN (1, 2, 3, 4));

-- Crear índice para búsquedas por sector
CREATE INDEX IF NOT EXISTS idx_order_list_items_sector ON order_list_items(sector);

-- Actualizar items existentes para que tengan sector 1 por defecto (opcional)
-- UPDATE order_list_items SET sector = 1 WHERE sector IS NULL;
