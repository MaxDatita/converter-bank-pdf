-- Habilitar Row Level Security en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Políticas para la tabla users
-- Los usuarios solo pueden ver y editar su propio perfil
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Permitir inserción de nuevos usuarios (para el registro)
CREATE POLICY "Enable insert for new users" ON users
    FOR INSERT WITH CHECK (true);

-- Políticas para monthly_usage
-- Los usuarios solo pueden ver su propio uso mensual
CREATE POLICY "Users can view own monthly usage" ON monthly_usage
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own monthly usage" ON monthly_usage
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own monthly usage" ON monthly_usage
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Políticas para daily_usage
-- Los usuarios solo pueden ver su propio uso diario
CREATE POLICY "Users can view own daily usage" ON daily_usage
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own daily usage" ON daily_usage
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own daily usage" ON daily_usage
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Políticas para conversion_history
-- Los usuarios solo pueden ver su propio historial
CREATE POLICY "Users can view own conversion history" ON conversion_history
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own conversion history" ON conversion_history
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Políticas para verification_codes
-- Permitir lectura y escritura para el sistema de autenticación
-- Nota: En producción, esto debería manejarse desde el servidor
CREATE POLICY "Enable read access for verification codes" ON verification_codes
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for verification codes" ON verification_codes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for verification codes" ON verification_codes
    FOR UPDATE USING (true);
