-- Create wallet_events table for tracking all wallet generation events
CREATE TABLE IF NOT EXISTS wallet_events (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_wallet_events_ip ON wallet_events(ip_address);
CREATE INDEX idx_wallet_events_type ON wallet_events(event_type);
CREATE INDEX idx_wallet_events_created ON wallet_events(created_at DESC);

-- Create IP visits table if not exists
CREATE TABLE IF NOT EXISTS ip_visits (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    country VARCHAR(100),
    city VARCHAR(100),
    region VARCHAR(100),
    country_code VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ip_visits_ip ON ip_visits(ip_address);
CREATE INDEX idx_ip_visits_created ON ip_visits(created_at DESC);

-- Create user journey table for tracking complete user flows
CREATE TABLE IF NOT EXISTS user_journey (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    wallet_address VARCHAR(42),
    stage_number INTEGER NOT NULL,
    stage_name VARCHAR(50) NOT NULL,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    tx_hash VARCHAR(66),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user journey
CREATE INDEX idx_user_journey_ip ON user_journey(ip_address);
CREATE INDEX idx_user_journey_wallet ON user_journey(wallet_address);
CREATE INDEX idx_user_journey_created ON user_journey(created_at DESC);
CREATE INDEX idx_user_journey_stage ON user_journey(stage_number);

-- Create flow completions table if not exists
CREATE TABLE IF NOT EXISTS flow_completions (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    wallet_address VARCHAR(42),
    gift_card_purchased BOOLEAN DEFAULT false,
    user_agent TEXT,
    referer TEXT,
    metadata JSONB,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for flow completions
CREATE INDEX idx_flow_completions_ip ON flow_completions(ip_address);
CREATE INDEX idx_flow_completions_wallet ON flow_completions(wallet_address);
CREATE INDEX idx_flow_completions_completed ON flow_completions(completed_at DESC);