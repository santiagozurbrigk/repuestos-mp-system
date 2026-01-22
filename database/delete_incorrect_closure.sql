-- Script para eliminar el cierre incorrecto del 21 de enero
-- Ejecuta esto en Supabase SQL Editor para corregir el problema

-- Primero, verifica qué cierres existen
SELECT 
  id,
  closure_date,
  total_sales,
  sales_count,
  closed_at,
  created_at
FROM cash_closures
ORDER BY closure_date DESC;

-- Si confirmas que el cierre del 21 es incorrecto, elimínalo:
-- (Descomenta la siguiente línea después de verificar)
-- DELETE FROM cash_closures WHERE closure_date = '2026-01-21';

-- Después de eliminar, podrás cerrar la caja correctamente para el día 22
