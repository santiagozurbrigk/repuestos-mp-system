-- Script para crear la tabla supplier_invoice_items en Supabase
-- Ejecutar este script en el SQL Editor de Supabase

-- Asegurarse de que la función update_updated_at_column existe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabla de items/productos de facturas de proveedores
CREATE TABLE IF NOT EXISTS supplier_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para items de facturas
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_items_invoice_id ON supplier_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_items_user_id ON supplier_invoice_items(user_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_supplier_invoice_items_updated_at ON supplier_invoice_items;
CREATE TRIGGER update_supplier_invoice_items_updated_at 
  BEFORE UPDATE ON supplier_invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE supplier_invoice_items ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (para evitar errores al re-ejecutar)
DROP POLICY IF EXISTS "Users can view all supplier invoice items" ON supplier_invoice_items;
DROP POLICY IF EXISTS "Users can create supplier invoice items" ON supplier_invoice_items;
DROP POLICY IF EXISTS "Users can update own supplier invoice items" ON supplier_invoice_items;
DROP POLICY IF EXISTS "Admins can update any supplier invoice items" ON supplier_invoice_items;
DROP POLICY IF EXISTS "Users can delete own supplier invoice items" ON supplier_invoice_items;
DROP POLICY IF EXISTS "Admins can delete any supplier invoice items" ON supplier_invoice_items;

-- Políticas para supplier_invoice_items
CREATE POLICY "Users can view all supplier invoice items"
  ON supplier_invoice_items FOR SELECT
  USING (true);

CREATE POLICY "Users can create supplier invoice items"
  ON supplier_invoice_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplier invoice items"
  ON supplier_invoice_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any supplier invoice items"
  ON supplier_invoice_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own supplier invoice items"
  ON supplier_invoice_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any supplier invoice items"
  ON supplier_invoice_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
