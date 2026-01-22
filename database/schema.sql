-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios (se sincroniza con Supabase Auth)
-- Los usuarios se crean automáticamente con Supabase Auth
-- Esta tabla almacena información adicional del perfil

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de ventas
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para ventas
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);

-- Tabla de cierres de caja
CREATE TABLE IF NOT EXISTS cash_closures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  closure_date DATE NOT NULL UNIQUE,
  total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_cash DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_card DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_transfer DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_other DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para cierres de caja
CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON cash_closures(closure_date);
CREATE INDEX IF NOT EXISTS idx_cash_closures_user_id ON cash_closures(user_id);

-- Tabla de listas de pedidos
CREATE TABLE IF NOT EXISTS order_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para listas de pedidos
CREATE INDEX IF NOT EXISTS idx_order_lists_date ON order_lists(created_date);
CREATE INDEX IF NOT EXISTS idx_order_lists_status ON order_lists(status);
CREATE INDEX IF NOT EXISTS idx_order_lists_user_id ON order_lists(user_id);

-- Tabla de artículos en listas de pedidos
CREATE TABLE IF NOT EXISTS order_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_list_id UUID NOT NULL REFERENCES order_lists(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  brand TEXT,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para artículos de listas
CREATE INDEX IF NOT EXISTS idx_order_list_items_list_id ON order_list_items(order_list_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_lists_updated_at BEFORE UPDATE ON order_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para crear perfil de usuario automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil cuando se crea un usuario en auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Políticas de seguridad (RLS) - Row Level Security

-- Habilitar RLS en todas las tablas
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_list_items ENABLE ROW LEVEL SECURITY;

-- Políticas para user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para sales
CREATE POLICY "Users can view all sales"
  ON sales FOR SELECT
  USING (true);

CREATE POLICY "Users can create sales"
  ON sales FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sales"
  ON sales FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any sales"
  ON sales FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own sales"
  ON sales FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any sales"
  ON sales FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para cash_closures
CREATE POLICY "Users can view all cash closures"
  ON cash_closures FOR SELECT
  USING (true);

CREATE POLICY "Users can create cash closures"
  ON cash_closures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update cash closures"
  ON cash_closures FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para order_lists
CREATE POLICY "Users can view all order lists"
  ON order_lists FOR SELECT
  USING (true);

CREATE POLICY "Users can create order lists"
  ON order_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own order lists"
  ON order_lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any order lists"
  ON order_lists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own order lists"
  ON order_lists FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any order lists"
  ON order_lists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Políticas para order_list_items
CREATE POLICY "Users can view all order list items"
  ON order_list_items FOR SELECT
  USING (true);

CREATE POLICY "Users can create order list items"
  ON order_list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_lists
      WHERE id = order_list_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update order list items"
  ON order_list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM order_lists
      WHERE id = order_list_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete order list items"
  ON order_list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM order_lists
      WHERE id = order_list_id AND user_id = auth.uid()
    )
  );
