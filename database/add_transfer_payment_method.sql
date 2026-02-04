-- Agregar método de pago "transfer" (Transferencia)
-- Este script agrega la columna total_transfer a cash_closures y actualiza el constraint de sales

-- Agregar columna total_transfer a cash_closures si no existe
ALTER TABLE cash_closures 
  ADD COLUMN IF NOT EXISTS total_transfer DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Actualizar el constraint CHECK en sales para incluir 'transfer'
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check 
  CHECK (payment_method IN ('cash', 'debit', 'credit', 'transfer', 'expenses', 'freight'));
