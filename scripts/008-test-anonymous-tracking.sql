-- Script de prueba para verificar el tracking de usuarios anónimos
-- Ejecutar DESPUÉS de aplicar los scripts 006 y 007

-- 1. Verificar que la tabla anonymous_usage existe y tiene la estructura correcta
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'anonymous_usage'
ORDER BY ordinal_position;

-- 2. Verificar que las tablas modificadas permiten user_id NULL
SELECT 
  table_name, 
  column_name, 
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('daily_usage', 'monthly_usage', 'conversion_history')
  AND column_name = 'user_id'
ORDER BY table_name;

-- 3. Verificar que los índices únicos se crearon correctamente
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('daily_usage', 'monthly_usage')
  AND indexname LIKE '%user_date%'
ORDER BY tablename;

-- 4. Verificar que los índices para usuarios anónimos existen
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('daily_usage', 'monthly_usage')
  AND indexname LIKE '%anonymous%'
ORDER BY tablename;

-- 5. Insertar un registro de prueba en anonymous_usage
INSERT INTO anonymous_usage (ip_address, date, pages_processed, files_processed)
VALUES ('192.168.1.1', CURRENT_DATE, 1, 1)
ON CONFLICT (ip_address, date) 
DO UPDATE SET 
  pages_processed = anonymous_usage.pages_processed + EXCLUDED.pages_processed,
  files_processed = anonymous_usage.files_processed + EXCLUDED.files_processed,
  updated_at = NOW();

-- 6. Insertar un registro de prueba en daily_usage para usuario anónimo
INSERT INTO daily_usage (user_id, date, pages_processed, files_processed)
VALUES (NULL, CURRENT_DATE, 1, 1)
ON CONFLICT (user_id, date) 
DO UPDATE SET 
  pages_processed = daily_usage.pages_processed + EXCLUDED.pages_processed,
  files_processed = daily_usage.files_processed + EXCLUDED.files_processed,
  updated_at = NOW();

-- 7. Insertar un registro de prueba en monthly_usage para usuario anónimo
INSERT INTO monthly_usage (user_id, year, month, pages_processed, files_processed)
VALUES (NULL, EXTRACT(YEAR FROM CURRENT_DATE), EXTRACT(MONTH FROM CURRENT_DATE), 1, 1)
ON CONFLICT (user_id, year, month) 
DO UPDATE SET 
  pages_processed = monthly_usage.pages_processed + EXCLUDED.pages_processed,
  files_processed = monthly_usage.files_processed + EXCLUDED.files_processed,
  updated_at = NOW();

-- 8. Verificar que los registros de prueba se insertaron correctamente
SELECT 'anonymous_usage' as table_name, ip_address::text, date, pages_processed, files_processed
FROM anonymous_usage 
WHERE date = CURRENT_DATE
UNION ALL
SELECT 'daily_usage (anonymous)' as table_name, 'NULL' as ip_address, date, pages_processed, files_processed
FROM daily_usage 
WHERE user_id IS NULL AND date = CURRENT_DATE
UNION ALL
SELECT 'monthly_usage (anonymous)' as table_name, 'NULL' as ip_address, 
       CONCAT(year, '-', month) as date, pages_processed, files_processed
FROM monthly_usage 
WHERE user_id IS NULL 
  AND year = EXTRACT(YEAR FROM CURRENT_DATE) 
  AND month = EXTRACT(MONTH FROM CURRENT_DATE);

-- 9. Limpiar registros de prueba (opcional)
-- DELETE FROM anonymous_usage WHERE ip_address = '192.168.1.1' AND date = CURRENT_DATE;
-- DELETE FROM daily_usage WHERE user_id IS NULL AND date = CURRENT_DATE;
-- DELETE FROM monthly_usage WHERE user_id IS NULL AND year = EXTRACT(YEAR FROM CURRENT_DATE) AND month = EXTRACT(MONTH FROM CURRENT_DATE);
