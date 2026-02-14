-- Agregar campo tomorrow_change a la tabla cash_closures
-- Este campo almacena el efectivo que queda en caja para el día siguiente

ALTER TABLE cash_closures 
  ADD COLUMN IF NOT EXISTS tomorrow_change DECIMAL(10, 2) DEFAULT NULL;

-- Comentario para documentar el campo
COMMENT ON COLUMN cash_closures.tomorrow_change IS 'Efectivo que queda en caja para el día siguiente. Este valor se usará como "Cambio (efectivo del día anterior)" del día siguiente.';
