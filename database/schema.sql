-- Whale Agent Database Schema for Railway PostgreSQL
-- Run this after provisioning your Railway database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for better text search (optional but recommended)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Token snapshots table (DexScreener data every 30 min)
CREATE TABLE IF NOT EXISTS token_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_address TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Price & Volume from DexScreener
    price_usd DECIMAL(20, 10),
    price_change_5m DECIMAL(10, 4),
    price_change_1h DECIMAL(10, 4),
    price_change_6h DECIMAL(10, 4),
    price_change_24h DECIMAL(10, 4),
    
    volume_5m DECIMAL(20, 2),
    volume_1h DECIMAL(20, 2),
    volume_6h DECIMAL(20, 2),
    volume_24h DECIMAL(20, 2),
    
    liquidity_usd DECIMAL(20, 2),
    market_cap DECIMAL(20, 2),
    
    -- Transaction metrics
    txns_5m_buys INTEGER,
    txns_5m_sells INTEGER,
    txns_1h_buys INTEGER,
    txns_1h_sells INTEGER,
    txns_6h_buys INTEGER,
    txns_6h_sells INTEGER,
    txns_24h_buys INTEGER,
    txns_24h_sells INTEGER,
    
    -- Holder metrics (from The Graph / RPC)
    total_holders INTEGER,
    holder_change_24h INTEGER,
    
    -- Whale concentration
    top_10_concentration DECIMAL(5, 2),
    top_20_concentration DECIMAL(5, 2),
    top_50_concentration DECIMAL(5, 2),
    
    -- Metadata
    data_source TEXT, -- 'dexscreener', 'thegraph', 'rpc'
    
    UNIQUE(token_address, timestamp)
);

-- Whale positions table (top 50 holders tracked every 6h)
CREATE TABLE IF NOT EXISTS whale_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_address TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    balance DECIMAL(30, 10),
    percentage_of_supply DECIMAL(5, 4),
    holder_rank INTEGER,
    value_usd DECIMAL(20, 2),
    
    -- Track if this is a new or exiting whale
    is_new_whale BOOLEAN DEFAULT FALSE,
    is_exiting BOOLEAN DEFAULT FALSE,
    
    UNIQUE(token_address, wallet_address, timestamp)
);

-- Whale transactions table (large transfers >1% supply)
CREATE TABLE IF NOT EXISTS whale_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_address TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    block_number BIGINT,
    transaction_hash TEXT UNIQUE,
    
    wallet_address TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'transfer')),
    
    amount_tokens DECIMAL(30, 10),
    amount_usd DECIMAL(20, 2),
    percentage_of_supply DECIMAL(5, 4),
    
    wallet_balance_before DECIMAL(30, 10),
    wallet_balance_after DECIMAL(30, 10),
    wallet_rank_after INTEGER
);

-- Whale reports table (generated every 6h)
CREATE TABLE IF NOT EXISTS whale_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_address TEXT NOT NULL,
    report_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Summary metrics
    total_holders INTEGER,
    top_10_concentration DECIMAL(5, 2),
    top_20_concentration DECIMAL(5, 2),
    top_50_concentration DECIMAL(5, 2),
    
    -- Price & Volume summary
    current_price DECIMAL(20, 10),
    price_change_6h DECIMAL(10, 4),
    price_change_24h DECIMAL(10, 4),
    volume_6h DECIMAL(20, 2),
    volume_24h DECIMAL(20, 2),
    liquidity_usd DECIMAL(20, 2),
    
    -- Changes since last report
    concentration_change_6h DECIMAL(5, 2),
    new_whales_count INTEGER,
    exited_whales_count INTEGER,
    
    -- Whale activity
    accumulating_whales INTEGER,
    distributing_whales INTEGER,
    net_whale_flow_usd DECIMAL(20, 2),
    
    -- Risk analysis
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    signals JSONB,
    concerns JSONB,
    positive_indicators JSONB,
    
    -- Full report data
    report_json JSONB,
    report_markdown TEXT,
    
    -- Delivery status
    telegram_sent BOOLEAN DEFAULT FALSE,
    telegram_sent_at TIMESTAMPTZ,
    
    UNIQUE(token_address, report_timestamp)
);

-- Create indexes for performance
CREATE INDEX idx_snapshots_token_time ON token_snapshots(token_address, timestamp DESC);
CREATE INDEX idx_snapshots_timestamp ON token_snapshots(timestamp DESC);

CREATE INDEX idx_whale_pos_token_time ON whale_positions(token_address, timestamp DESC);
CREATE INDEX idx_whale_pos_wallet ON whale_positions(wallet_address, timestamp DESC);
CREATE INDEX idx_whale_pos_token_wallet ON whale_positions(token_address, wallet_address);

CREATE INDEX idx_whale_tx_token_time ON whale_transactions(token_address, timestamp DESC);
CREATE INDEX idx_whale_tx_wallet ON whale_transactions(wallet_address, timestamp DESC);
CREATE INDEX idx_whale_tx_hash ON whale_transactions(transaction_hash);

CREATE INDEX idx_reports_token_time ON whale_reports(token_address, report_timestamp DESC);
CREATE INDEX idx_reports_timestamp ON whale_reports(report_timestamp DESC);
CREATE INDEX idx_reports_telegram_pending ON whale_reports(telegram_sent) WHERE telegram_sent = FALSE;

-- Create a function to get latest snapshot for a token
CREATE OR REPLACE FUNCTION get_latest_snapshot(p_token_address TEXT)
RETURNS TABLE (
    price_usd DECIMAL,
    volume_24h DECIMAL,
    liquidity_usd DECIMAL,
    price_change_24h DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.price_usd,
        s.volume_24h,
        s.liquidity_usd,
        s.price_change_24h
    FROM token_snapshots s
    WHERE s.token_address = p_token_address
    ORDER BY s.timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create a function to calculate concentration changes
CREATE OR REPLACE FUNCTION get_concentration_trend(
    p_token_address TEXT,
    p_hours_ago INTEGER
)
RETURNS DECIMAL AS $$
DECLARE
    v_current DECIMAL;
    v_previous DECIMAL;
BEGIN
    -- Get current concentration
    SELECT top_10_concentration INTO v_current
    FROM token_snapshots
    WHERE token_address = p_token_address
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- Get previous concentration
    SELECT top_10_concentration INTO v_previous
    FROM token_snapshots
    WHERE token_address = p_token_address
        AND timestamp <= NOW() - (p_hours_ago || ' hours')::INTERVAL
    ORDER BY timestamp DESC
    LIMIT 1;
    
    RETURN COALESCE(v_current - v_previous, 0);
END;
$$ LANGUAGE plpgsql;

-- Create view for latest whale positions per token
CREATE OR REPLACE VIEW latest_whale_positions AS
SELECT DISTINCT ON (token_address, wallet_address)
    *
FROM whale_positions
ORDER BY token_address, wallet_address, timestamp DESC;

-- Comments for documentation
COMMENT ON TABLE token_snapshots IS 'Stores periodic snapshots of token metrics from DexScreener and on-chain data';
COMMENT ON TABLE whale_positions IS 'Tracks top 50 holder positions over time';
COMMENT ON TABLE whale_transactions IS 'Records large whale transactions (>1% supply)';
COMMENT ON TABLE whale_reports IS 'Stores generated whale analysis reports every 6 hours';

COMMENT ON COLUMN token_snapshots.data_source IS 'Source of data: dexscreener, thegraph, or rpc';
COMMENT ON COLUMN whale_reports.risk_score IS 'Risk score from 0 (low risk) to 100 (high risk)';
COMMENT ON COLUMN whale_reports.telegram_sent IS 'Whether the report has been sent to Telegram';
