-- Tabla de stock pendiente (productos escaneados de facturas que esperan código de barras)
CREATE TABLE IF NOT EXISTS stock_pending (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  invoice_item_id UUID REFERENCES supplier_invoice_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  code TEXT,
  brand TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  barcode TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de stock (productos confirmados con código de barras)
CREATE TABLE IF NOT EXISTS stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  code TEXT,
  brand TEXT,
  barcode TEXT UNIQUE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para stock_pending
CREATE INDEX IF NOT EXISTS idx_stock_pending_invoice_id ON stock_pending(invoice_id);
CREATE INDEX IF NOT EXISTS idx_stock_pending_invoice_item_id ON stock_pending(invoice_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_pending_user_id ON stock_pending(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_pending_barcode ON stock_pending(barcode) WHERE barcode IS NOT NULL;

-- Índices para stock
CREATE INDEX IF NOT EXISTS idx_stock_user_id ON stock(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_barcode ON stock(barcode);
CREATE INDEX IF NOT EXISTS idx_stock_code ON stock(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_item_name ON stock(item_name);

-- Triggers para updated_at
CREATE TRIGGER update_stock_pending_updated_at BEFORE UPDATE ON stock_pending
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE stock_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

-- Políticas para stock_pending
CREATE POLICY "Users can view all stock pending items"
  ON stock_pending FOR SELECT
  USING (true);

CREATE POLICY "Users can create stock pending items"
  ON stock_pending FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stock pending items"
  ON stock_pending FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any stock pending items"
  ON stock_pending FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own stock pending items"
  ON stock_pending FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any stock pending items"
  ON stock_pending FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para stock
CREATE POLICY "Users can view all stock items"
  ON stock FOR SELECT
  USING (true);

CREATE POLICY "Users can create stock items"
  ON stock FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stock items"
  ON stock FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any stock items"
  ON stock FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own stock items"
  ON stock FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any stock items"
  ON stock FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
