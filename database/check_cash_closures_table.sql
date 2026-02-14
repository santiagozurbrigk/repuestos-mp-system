-- Script para verificar si la tabla cash_closures existe y en qué esquema

-- Verificar todas las tablas que contengan "cash" o "closure" en el nombre
SELECT 
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_name LIKE '%cash%' 
   OR table_name LIKE '%closure%'
ORDER BY table_schema, table_name;

-- Verificar específicamente en el esquema public
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%cash%' OR table_name LIKE '%closure%')
ORDER BY table_name;
