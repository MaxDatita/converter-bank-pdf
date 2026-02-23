-- Script para actualizar las tablas existentes y permitir usuarios anónimos
-- Este script debe ejecutarse DESPUÉS de crear la tabla anonymous_usage

-- 1. Modificar daily_usage para permitir user_id NULL (usuarios anónimos)
ALTER TABLE daily_usage 
DROP CONSTRAINT IF EXISTS daily_usage_user_id_fkey;

ALTER TABLE daily_usage 
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Modificar monthly_usage para permitir user_id NULL (usuarios anónimos)
ALTER TABLE monthly_usage 
DROP CONSTRAINT IF EXISTS monthly_usage_user_id_fkey;

ALTER TABLE monthly_usage 
ALTER COLUMN user_id DROP NOT NULL;

-- 3. Modificar conversion_history para permitir user_id NULL (usuarios anónimos)
ALTER TABLE conversion_history 
DROP CONSTRAINT IF EXISTS conversion_history_user_id_fkey;

ALTER TABLE conversion_history 
ALTER COLUMN user_id DROP NOT NULL;

-- 4. Agregar restricciones únicas que permitan NULL
-- Para daily_usage: permitir múltiples registros con user_id NULL por fecha
DROP INDEX IF EXISTS idx_daily_usage_user_date;
CREATE UNIQUE INDEX idx_daily_usage_user_date ON daily_usage(user_id, date) 
WHERE user_id IS NOT NULL;

-- Para monthly_usage: permitir múltiples registros con user_id NULL por año/mes
DROP INDEX IF EXISTS idx_monthly_usage_user_date;
CREATE UNIQUE INDEX idx_monthly_usage_user_date ON monthly_usage(user_id, year, month) 
WHERE user_id IS NOT NULL;

-- 5. Crear índices separados para usuarios anónimos
CREATE INDEX IF EXISTS idx_daily_usage_anonymous ON daily_usage(date) 
WHERE user_id IS NULL;

CREATE INDEX IF EXISTS idx_monthly_usage_anonymous ON monthly_usage(year, month) 
WHERE user_id IS NULL;

-- 6. Agregar comentarios explicativos
COMMENT ON COLUMN daily_usage.user_id IS 'NULL para usuarios anónimos, UUID para usuarios registrados';
COMMENT ON COLUMN monthly_usage.user_id IS 'NULL para usuarios anónimos, UUID para usuarios registrados';
COMMENT ON COLUMN conversion_history.user_id IS 'NULL para usuarios anónimos, UUID para usuarios registrados';

-- 7. Verificar que las modificaciones se aplicaron correctamente
-- Esta consulta debería mostrar las columnas modificadas
SELECT 
  table_name, 
  column_name, 
  is_nullable, 
  data_type
FROM information_schema.columns 
WHERE table_name IN ('daily_usage', 'monthly_usage', 'conversion_history')
  AND column_name = 'user_id'
ORDER BY table_name;
