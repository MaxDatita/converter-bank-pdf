-- Function to get conversion history for a specific user
-- This function bypasses RLS policies and works reliably
CREATE OR REPLACE FUNCTION debug_conversion_history(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  filename TEXT,
  bank_name TEXT,
  account_type TEXT,
  period TEXT,
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
