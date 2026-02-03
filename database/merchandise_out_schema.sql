-- Tabla de egresos de mercadería (facturas escaneadas)
CREATE TABLE IF NOT EXISTS merchandise_out (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  barcode TEXT NOT NULL UNIQUE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  is_paid BOOLEAN NOT NULL DEFAULT false,
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'debit', 'credit', 'transfer')),
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de productos en egresos de mercadería
CREATE TABLE IF NOT EXISTS merchandise_out_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchandise_out_id UUID NOT NULL REFERENCES merchandise_out(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_code TEXT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_price DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  brand TEXT,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_merchandise_out_user_id ON merchandise_out(user_id);
CREATE INDEX IF NOT EXISTS idx_merchandise_out_supplier_id ON merchandise_out(supplier_id);
CREATE INDEX IF NOT EXISTS idx_merchandise_out_barcode ON merchandise_out(barcode);
CREATE INDEX IF NOT EXISTS idx_merchandise_out_invoice_date ON merchandise_out(invoice_date);
CREATE INDEX IF NOT EXISTS idx_merchandise_out_scanned_at ON merchandise_out(scanned_at);
CREATE INDEX IF NOT EXISTS idx_merchandise_out_items_merchandise_out_id ON merchandise_out_items(merchandise_out_id);

-- Trigger para updated_at
CREATE TRIGGER update_merchandise_out_updated_at BEFORE UPDATE ON merchandise_out
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE merchandise_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchandise_out_items ENABLE ROW LEVEL SECURITY;

-- Políticas para merchandise_out
CREATE POLICY "Users can view all merchandise out"
  ON merchandise_out FOR SELECT
  USING (true);

CREATE POLICY "Users can create merchandise out"
  ON merchandise_out FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own merchandise out"
  ON merchandise_out FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any merchandise out"
  ON merchandise_out FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own merchandise out"
  ON merchandise_out FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any merchandise out"
  ON merchandise_out FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para merchandise_out_items
CREATE POLICY "Users can view all merchandise out items"
  ON merchandise_out_items FOR SELECT
  USING (true);

CREATE POLICY "Users can create merchandise out items"
  ON merchandise_out_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM merchandise_out
      WHERE id = merchandise_out_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update merchandise out items"
  ON merchandise_out_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM merchandise_out
      WHERE id = merchandise_out_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete merchandise out items"
  ON merchandise_out_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM merchandise_out
      WHERE id = merchandise_out_id AND user_id = auth.uid()
    )
  );
