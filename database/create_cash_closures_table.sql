-- Crear tabla cash_closures completa con todos los campos necesarios
-- Incluye el campo tomorrow_change desde el inicio

CREATE TABLE IF NOT EXISTS public.cash_closures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  closure_date DATE NOT NULL UNIQUE,
  total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cash DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_debit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_transfer DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_freight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  initial_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  final_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  fernando_commission DECIMAL(10, 2) NOT NULL DEFAULT 0,
  pedro_commission DECIMAL(10, 2) NOT NULL DEFAULT 0,
  change DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tomorrow_change DECIMAL(10, 2) DEFAULT NULL,
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON public.cash_closures(closure_date);
CREATE INDEX IF NOT EXISTS idx_cash_closures_user_id ON public.cash_closures(user_id);

-- Comentarios para documentar campos importantes
COMMENT ON COLUMN public.cash_closures.change IS 'Efectivo del día anterior que se suma al efectivo del día actual';
COMMENT ON COLUMN public.cash_closures.tomorrow_change IS 'Efectivo que queda en caja para el día siguiente. Este valor se usará como "Cambio (efectivo del día anterior)" del día siguiente.';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

-- Política RLS: Los usuarios solo pueden ver sus propios cierres de caja
CREATE POLICY "Users can view their own cash closures"
  ON public.cash_closures
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política RLS: Los usuarios solo pueden crear sus propios cierres de caja
CREATE POLICY "Users can create their own cash closures"
  ON public.cash_closures
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política RLS: Los usuarios solo pueden actualizar sus propios cierres de caja
CREATE POLICY "Users can update their own cash closures"
  ON public.cash_closures
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política RLS: Los usuarios solo pueden eliminar sus propios cierres de caja
CREATE POLICY "Users can delete their own cash closures"
  ON public.cash_closures
  FOR DELETE
  USING (auth.uid() = user_id);
