import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Analytics endpoint to view tracking data
 * Optional: Protect with ANALYTICS_API_KEY env var
 */

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
  : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optional API key protection
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (process.env.ANALYTICS_API_KEY && apiKey !== process.env.ANALYTICS_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Analytics not configured' });
  }

  try {
    const { 
      limit = 100, 
      endpoint,
      wallet_address,
      ip_address,
      hours = 24 
    } = req.query;

    // Build query
    let query = supabase
      .from('endpoint_hits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    // Add filters
    if (endpoint) {
      query = query.eq('endpoint', endpoint);
    }
    if (wallet_address) {
      query = query.eq('wallet_address', wallet_address);
    }
    if (ip_address) {
      query = query.eq('ip_address', ip_address);
    }

    // Time filter
    const since = new Date();
    since.setHours(since.getHours() - Number(hours));
    query = query.gte('created_at', since.toISOString());

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Get summary stats
    const statsQuery = supabase
      .from('endpoint_hits')
      .select('endpoint')
      .gte('created_at', since.toISOString());

    const { data: allHits } = await statsQuery;

    const stats = {
      total_hits: allHits?.length || 0,
      unique_endpoints: [...new Set(allHits?.map(h => h.endpoint) || [])].length,
      time_range: `Last ${hours} hours`,
      endpoint_counts: allHits?.reduce((acc: any, hit: any) => {
        acc[hit.endpoint] = (acc[hit.endpoint] || 0) + 1;
        return acc;
      }, {})
    };

    return res.status(200).json({
      stats,
      recent_hits: data,
      query_params: { limit, endpoint, wallet_address, ip_address, hours }
    });

  } catch (error: any) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: error.message 
    });
  }
}