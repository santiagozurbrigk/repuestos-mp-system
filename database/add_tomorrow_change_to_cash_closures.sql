-- Agregar campo tomorrow_change a la tabla cash_closures
-- Este campo almacena el efectivo que queda en caja para el día siguiente
-- 
-- IMPORTANTE: Si la tabla cash_closures no existe, ejecuta primero:
-- database/create_cash_closures_table.sql

-- Verificar si la tabla existe antes de agregar la columna
DO $$
BEGIN
  -- Intentar agregar la columna si la tabla existe
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_closures'
  ) THEN
    -- Agregar la columna si no existe
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cash_closures' 
      AND column_name = 'tomorrow_change'
    ) THEN
      ALTER TABLE public.cash_closures 
        ADD COLUMN tomorrow_change DECIMAL(10, 2) DEFAULT NULL;
      
      -- Comentario para documentar el campo
      COMMENT ON COLUMN public.cash_closures.tomorrow_change IS 'Efectivo que queda en caja para el día siguiente. Este valor se usará como "Cambio (efectivo del día anterior)" del día siguiente.';
      
      RAISE NOTICE 'Columna tomorrow_change agregada exitosamente a cash_closures';
    ELSE
      RAISE NOTICE 'La columna tomorrow_change ya existe en cash_closures';
    END IF;
  ELSE
    RAISE EXCEPTION 'La tabla cash_closures no existe. Por favor, ejecuta primero el script create_cash_closures_table.sql para crear la tabla.';
  END IF;
END $$;
