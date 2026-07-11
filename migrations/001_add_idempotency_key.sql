-- Run this manually against the live database (Railway) — init.sql only
-- runs on first container bootstrap and will NOT touch an existing DB.
--
--   psql "$DATABASE_URL" -f migrations/001_add_idempotency_key.sql

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_account_idempotency_key
  ON transactions (account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
