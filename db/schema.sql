PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  line_user_id TEXT PRIMARY KEY,
  line_display_name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  claimed_flg INTEGER NOT NULL DEFAULT 0 CHECK (claimed_flg IN (0, 1)),
  claimed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_logs (
  claim_id TEXT PRIMARY KEY,
  line_user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  nft_token_id TEXT,
  coin_amount INTEGER NOT NULL,
  nft_tx_hash TEXT,
  coin_tx_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  error_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (line_user_id) REFERENCES users (line_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_logs_pending_or_success_once
  ON claim_logs (line_user_id)
  WHERE status IN ('PENDING', 'SUCCESS');

CREATE INDEX IF NOT EXISTS idx_claim_logs_created_at
  ON claim_logs (created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  campaign_name TEXT PRIMARY KEY,
  claim_start_at TEXT NOT NULL,
  claim_end_at TEXT NOT NULL,
  coin_amount INTEGER NOT NULL CHECK (coin_amount > 0),
  nft_name TEXT NOT NULL,
  nft_description TEXT NOT NULL,
  terms_url TEXT NOT NULL
);
