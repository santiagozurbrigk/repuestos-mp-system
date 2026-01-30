-- Actualizar métodos de pago en la tabla sales
-- Cambiar de: cash, card, transfer, other
-- A: cash, debit, credit, expenses, freight

-- Primero, actualizar los valores existentes
UPDATE sales 
SET payment_method = CASE 
  WHEN payment_method = 'cash' THEN 'cash'
  WHEN payment_method = 'card' THEN 'debit'  -- Asumimos que las tarjetas anteriores son débito
  WHEN payment_method = 'transfer' THEN 'debit'  -- Transferencias como débito
  WHEN payment_method = 'other' THEN 'expenses'  -- Otros como gastos varios
  ELSE payment_method
END;

-- Actualizar el constraint CHECK
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check 
  CHECK (payment_method IN ('cash', 'debit', 'credit', 'expenses', 'freight'));

-- Agregar campos a cash_closures para retiros bancarios y comisiones de empleados
ALTER TABLE cash_closures 
  ADD COLUMN IF NOT EXISTS total_debit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credit DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_expenses DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_freight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_withdrawal DECIMAL(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fernando_commission DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedro_commission DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_balance DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Actualizar los valores de total_card a total_debit y total_credit en cierres existentes
-- Asumimos que total_card se divide entre débito y crédito (50/50 o según lógica de negocio)
UPDATE cash_closures 
SET 
  total_debit = COALESCE(total_card * 0.5, 0),
  total_credit = COALESCE(total_card * 0.5, 0),
  total_expenses = 0,
  total_freight = 0;

-- Eliminar columnas antiguas que ya no se usan
ALTER TABLE cash_closures 
  DROP COLUMN IF EXISTS total_card,
  DROP COLUMN IF EXISTS total_transfer,
  DROP COLUMN IF EXISTS total_other;

-- Crear índice para búsquedas por fecha de cierre (ya existe, pero lo dejamos)
-- CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON cash_closures(closure_date);
