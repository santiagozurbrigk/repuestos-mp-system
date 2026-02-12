-- Script para agregar el campo brand a la tabla supplier_invoice_items
-- Ejecutar este script en el SQL Editor de Supabase

-- Agregar columna brand si no existe
ALTER TABLE supplier_invoice_items 
ADD COLUMN IF NOT EXISTS brand TEXT;

-- Crear índice para búsquedas por marca (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_items_brand ON supplier_invoice_items(brand);
