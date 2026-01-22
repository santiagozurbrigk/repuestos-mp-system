-- Script para verificar y corregir fechas de cierres de caja
-- Ejecuta esto en Supabase SQL Editor si necesitas verificar o corregir fechas

-- Ver todos los cierres con sus fechas
SELECT 
  id,
  closure_date,
  total_sales,
  sales_count,
  closed_at,
  created_at
FROM cash_closures
ORDER BY closure_date DESC;

-- Ver ventas agrupadas por fecha
SELECT 
  DATE(date) as sale_date,
  COUNT(*) as sales_count,
  SUM(total_amount) as total_amount
FROM sales
GROUP BY DATE(date)
ORDER BY sale_date DESC;

-- Si necesitas eliminar un cierre específico (CUIDADO: esto elimina permanentemente)
-- Descomenta y ajusta la fecha:
-- DELETE FROM cash_closures WHERE closure_date = '2026-01-20';

-- Si necesitas actualizar la fecha de un cierre (CUIDADO: verifica primero)
-- Descomenta y ajusta:
-- UPDATE cash_closures 
-- SET closure_date = '2026-01-22' 
-- WHERE closure_date = '2026-01-20';
