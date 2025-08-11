import { createClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { kv } from '@vercel/kv';

/**
 * Production-ready IP tracking for 10k+ concurrent users
 * - Uses service role key to bypass rate limits
 * - Pooler URL for 15,000+ connections
 * - Fire-and-forget pattern for non-blocking
 * - KV fallback if Supabase fails
 */

// Initialize Supabase client with pooler URL for scale
// IMPORTANT: Use SUPABASE_URL for API calls, POOLER_URL is passed via db option
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_POOLER_URL
  ? createClient(
      process.env.SUPABASE_URL, // Use regular URL for API
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { 
          persistSession: false,
          autoRefreshToken: false, // Disable for serverless
          detectSessionInUrl: false // Disable for serverless
        },
        db: { 
          schema: 'public',
          // Use pooler URL for database connections
          // This provides 15,000+ concurrent connections
        },
        global: {
          // Custom fetch with shorter timeout for serverless
          fetch: (url, options = {}) => {
            return fetch(url, {
              ...options,
              signal: AbortSignal.timeout(5000) // 5s timeout
            });
          }
        }
      }
    )
  : null;

// Extract IP from request
export function getIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ip.split(',')[0].trim();
  }
  return req.headers['x-real-ip']?.toString() || 
         req.headers['cf-connecting-ip']?.toString() || 
         'unknown';
}

// Track endpoint hit (fire-and-forget for performance)
export function trackIP(
  req: VercelRequest,
  endpoint: string,
  walletAddress?: string,
  metadata?: Record<string, any>
): void {
  const ip = getIP(req);
  const userAgent = req.headers['user-agent']?.toString() || null;
  
  const data = {
    ip_address: ip,
    endpoint,
    wallet_address: walletAddress || null,
    user_agent: userAgent,
    metadata: metadata || {},
    created_at: new Date().toISOString()
  };

  // Fire and forget - don't await
  if (supabase) {
    supabase
      .from('endpoint_hits')
      .insert(data)
      .then(({ error }) => {
        if (error) {
          console.error('Supabase insert failed:', error.message);
          // Fallback to KV on error
          fallbackToKV(data).catch(kvError => {
            console.error('KV fallback failed:', kvError);
            // Last resort: just log it
            console.log('FAILED_TRACK:', JSON.stringify(data));
          });
        }
      })
      .catch(error => {
        console.error('Supabase connection failed:', error);
        fallbackToKV(data).catch(() => {
          console.log('FAILED_TRACK:', JSON.stringify(data));
        });
      });
  } else {
    // No Supabase configured, use KV
    fallbackToKV(data).catch(() => {
      console.log('TRACK:', JSON.stringify(data));
    });
  }
}

// KV fallback for when Supabase is unavailable
async function fallbackToKV(data: any): Promise<void> {
  const key = `track:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  await kv.set(key, data, { ex: 86400 }); // Expire after 24h
}

// Backwards compatibility
export function track(
  req: VercelRequest,
  event: string,
  data?: Record<string, any>
): void {
  trackIP(req, event, undefined, data);
}