-- Create wallet_events table for analytics tracking
CREATE TABLE IF NOT EXISTS public.wallet_events (
  id BIGSERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX idx_wallet_events_ip ON public.wallet_events(ip_address);
CREATE INDEX idx_wallet_events_type ON public.wallet_events(event_type);
CREATE INDEX idx_wallet_events_created ON public.wallet_events(created_at DESC);
CREATE INDEX idx_wallet_events_wallet ON public.wallet_events((metadata->>'wallet_address'));

-- Enable Row Level Security
ALTER TABLE public.wallet_events ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert/read (for API routes)
CREATE POLICY "Service role can manage wallet_events"
  ON public.wallet_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy to allow authenticated users to read (for dashboard)
CREATE POLICY "Authenticated users can read wallet_events"
  ON public.wallet_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Grant permissions to service_role
GRANT ALL ON public.wallet_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE wallet_events_id_seq TO service_role;
