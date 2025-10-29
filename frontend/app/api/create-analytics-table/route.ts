import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, '') || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, '') || '';

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  });

  try {
    console.log('Creating wallet_events table...');

    // Create the table using raw SQL via the pg client
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create wallet_events table for analytics tracking
        CREATE TABLE IF NOT EXISTS public.wallet_events (
          id BIGSERIAL PRIMARY KEY,
          ip_address TEXT NOT NULL,
          event_type TEXT NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );

        -- Create indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_wallet_events_ip ON public.wallet_events(ip_address);
        CREATE INDEX IF NOT EXISTS idx_wallet_events_type ON public.wallet_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_wallet_events_created ON public.wallet_events(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_wallet_events_wallet ON public.wallet_events((metadata->>'wallet_address'));

        -- Enable Row Level Security
        ALTER TABLE public.wallet_events ENABLE ROW LEVEL SECURITY;

        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Service role can manage wallet_events" ON public.wallet_events;
        DROP POLICY IF EXISTS "Authenticated users can read wallet_events" ON public.wallet_events;

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
      `
    });

    if (error) {
      // If exec_sql doesn't exist, return instructions
      if (error.code === 'PGRST202') {
        return NextResponse.json({
          error: 'Cannot execute SQL directly',
          message: 'Please run the migration manually',
          instructions: [
            '1. Go to https://supabase.com/dashboard/project/rggrxwjkqapbxioxkvmg/sql',
            '2. Copy the SQL from: frontend/supabase/migrations/20251028220641_create_wallet_events_table.sql',
            '3. Paste and click "Run"'
          ],
          sqlFile: 'frontend/supabase/migrations/20251028220641_create_wallet_events_table.sql'
        }, { status: 500 });
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Table created successfully',
      data
    });

  } catch (err: any) {
    console.error('Create table error:', err);

    return NextResponse.json({
      error: 'Failed to create table',
      message: err.message,
      instructions: [
        '1. Go to https://supabase.com/dashboard/project/rggrxwjkqapbxioxkvmg/sql',
        '2. Copy the SQL from: frontend/supabase/migrations/20251028220641_create_wallet_events_table.sql',
        '3. Paste and click "Run"'
      ]
    }, { status: 500 });
  }
}
