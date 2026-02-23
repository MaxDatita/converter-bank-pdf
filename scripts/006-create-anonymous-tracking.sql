-- Crear tabla para tracking de usuarios anónimos por IP address
CREATE TABLE IF NOT EXISTS anonymous_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  date DATE NOT NULL,
  pages_processed INTEGER DEFAULT 0,
  files_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ip_address, date)
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_ip_date ON anonymous_usage(ip_address, date);
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_date ON anonymous_usage(date);

-- Habilitar RLS
ALTER TABLE anonymous_usage ENABLE ROW LEVEL SECURITY;

-- Políticas para anonymous_usage (permitir inserción y lectura para el sistema)
CREATE POLICY "Enable insert for anonymous usage" ON anonymous_usage
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for anonymous usage" ON anonymous_usage
    FOR SELECT USING (true);

CREATE POLICY "Enable update for anonymous usage" ON anonymous_usage
    FOR UPDATE USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_anonymous_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_anonymous_usage_updated_at BEFORE UPDATE ON anonymous_usage
    FOR EACH ROW EXECUTE FUNCTION update_anonymous_usage_updated_at();

-- Función para limpiar registros antiguos (más de 30 días)
CREATE OR REPLACE FUNCTION cleanup_old_anonymous_usage()
RETURNS void AS $$
BEGIN
    DELETE FROM anonymous_usage 
    WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ language 'plpgsql';

-- Crear un job programado para limpiar registros antiguos (opcional)
-- Esto se puede configurar con pg_cron si está disponible
-- SELECT cron.schedule('cleanup-anonymous-usage', '0 2 * * *', 'SELECT cleanup_old_anonymous_usage();');
