-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para proveedores
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Tabla de facturas de proveedores
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  is_paid BOOLEAN NOT NULL DEFAULT false,
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT paid_amount_check CHECK (paid_amount <= amount)
);

-- Índices para facturas
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_user_id ON supplier_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_invoice_date ON supplier_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_is_paid ON supplier_invoices(is_paid);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_due_date ON supplier_invoices(due_date);

-- Trigger para updated_at en suppliers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at en supplier_invoices
CREATE TRIGGER update_supplier_invoices_updated_at BEFORE UPDATE ON supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

-- Políticas para suppliers
CREATE POLICY "Users can view all suppliers"
  ON suppliers FOR SELECT
  USING (true);

CREATE POLICY "Users can create suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers"
  ON suppliers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any suppliers"
  ON suppliers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own suppliers"
  ON suppliers FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any suppliers"
  ON suppliers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para supplier_invoices
CREATE POLICY "Users can view all supplier invoices"
  ON supplier_invoices FOR SELECT
  USING (true);

CREATE POLICY "Users can create supplier invoices"
  ON supplier_invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplier invoices"
  ON supplier_invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any supplier invoices"
  ON supplier_invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own supplier invoices"
  ON supplier_invoices FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any supplier invoices"
  ON supplier_invoices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
