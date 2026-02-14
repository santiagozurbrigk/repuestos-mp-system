-- Script para verificar si la tabla sales existe

-- Verificar si existe la tabla sales
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'sales';

-- Si no existe, mostrar todas las tablas relacionadas con ventas/pagos
SELECT 
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%sale%' 
       OR table_name LIKE '%payment%'
       OR table_name LIKE '%order%')
ORDER BY table_name;
