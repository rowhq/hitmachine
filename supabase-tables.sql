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