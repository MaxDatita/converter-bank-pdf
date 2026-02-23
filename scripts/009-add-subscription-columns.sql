-- Migración 009: Agregar columnas de suscripción de Mercado Pago a user_profiles

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS mp_subscription_id       TEXT,
  ADD COLUMN IF NOT EXISTS mp_subscription_status   TEXT
    CHECK (mp_subscription_status IN ('authorized', 'paused', 'cancelled', 'pending')),
  ADD COLUMN IF NOT EXISTS subscription_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_until        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_mp_subscription_id
  ON user_profiles(mp_subscription_id);

-- Comentarios para documentar el propósito de cada columna
COMMENT ON COLUMN user_profiles.mp_subscription_id IS 'ID del preapproval de Mercado Pago, usado para lookup en webhooks';
COMMENT ON COLUMN user_profiles.mp_subscription_status IS 'Último estado conocido de la suscripción MP: authorized, paused, cancelled, pending';
COMMENT ON COLUMN user_profiles.subscription_updated_at IS 'Timestamp de la última actualización del estado de suscripción vía webhook';
COMMENT ON COLUMN user_profiles.grace_period_until IS 'Si está activo, el usuario mantiene su plan aunque el pago haya fallado (cubre reintentos de cobro MP)';
