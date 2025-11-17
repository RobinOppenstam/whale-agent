-- Migration to fix numeric overflow for large token balances
-- Run this to update existing tables

-- Drop dependent view first
DROP VIEW IF EXISTS latest_whale_positions;

-- Update whale_positions table
ALTER TABLE whale_positions
  ALTER COLUMN balance TYPE TEXT,
  ALTER COLUMN percentage_of_supply TYPE DECIMAL(10, 6);

-- Update whale_transactions table (already done, but keeping for reference)
-- ALTER TABLE whale_transactions
--   ALTER COLUMN amount_tokens TYPE TEXT,
--   ALTER COLUMN percentage_of_supply TYPE DECIMAL(10, 6),
--   ALTER COLUMN wallet_balance_before TYPE TEXT,
--   ALTER COLUMN wallet_balance_after TYPE TEXT;

-- Recreate the view with the new schema
CREATE OR REPLACE VIEW latest_whale_positions AS
SELECT DISTINCT ON (token_address, wallet_address)
    *
FROM whale_positions
ORDER BY token_address, wallet_address, timestamp DESC;

-- Verify changes
\d whale_positions
\d whale_transactions
