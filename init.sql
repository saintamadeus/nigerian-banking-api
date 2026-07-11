CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number VARCHAR(10) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0.00,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  type VARCHAR(10) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  idempotency_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- A client-supplied Idempotency-Key is unique per account: retrying the
-- same key on the same account returns the original transaction instead
-- of applying the debit/credit twice. NULL keys are exempt (idempotency
-- is optional, not required) so this only constrains requests that opt in.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_account_idempotency_key
  ON transactions (account_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;