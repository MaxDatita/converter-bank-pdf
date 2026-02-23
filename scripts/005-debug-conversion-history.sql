-- Función para debuggear el historial de conversiones
CREATE OR REPLACE FUNCTION debug_conversion_history(user_uuid UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    filename VARCHAR,
    bank_name VARCHAR,
    account_type VARCHAR,
    period VARCHAR,
    pages_count INTEGER,
    transactions_count INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ch.id,
        ch.user_id,
        ch.filename,
        ch.bank_name,
        ch.account_type,
        ch.period,
        ch.pages_count,
        ch.transactions_count,
        ch.created_at
    FROM conversion_history ch
    WHERE ch.user_id = user_uuid
    ORDER BY ch.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- También crear una función para ver todas las conversiones con detalles del usuario
CREATE OR REPLACE FUNCTION get_all_conversions_with_users()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email VARCHAR,
    filename VARCHAR,
    bank_name VARCHAR,
    account_type VARCHAR,
    period VARCHAR,
    pages_count INTEGER,
    transactions_count INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ch.id,
        ch.user_id,
        up.email as user_email,
        ch.filename,
        ch.bank_name,
        ch.account_type,
        ch.period,
        ch.pages_count,
        ch.transactions_count,
        ch.created_at
    FROM conversion_history ch
    LEFT JOIN user_profiles up ON ch.user_id = up.id
    ORDER BY ch.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para buscar conversiones por UUID específico
CREATE OR REPLACE FUNCTION find_conversions_by_user_id(search_uuid TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    filename VARCHAR,
    created_at TIMESTAMPTZ,
    uuid_match BOOLEAN,
    uuid_length INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ch.id,
        ch.user_id,
        ch.filename,
        ch.created_at,
        (ch.user_id::text = search_uuid) as uuid_match,
        length(ch.user_id::text) as uuid_length
    FROM conversion_history ch
    WHERE ch.user_id IS NOT NULL
    ORDER BY ch.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
