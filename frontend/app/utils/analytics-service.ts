import { createClient } from '@supabase/supabase-js';
import { kv } from '@vercel/kv';
import type { NextRequest } from 'next/server';
import { getClientIP, getGeoInfo } from './ip-detection';

// Initialize Supabase client with serverless optimizations
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, '') || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, '') || '';

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  : null;

// Event types for tracking
export type EventType = 
  | 'generate_account_attempt'
  | 'wallet_generated'
  | 'wallet_funded'
  | 'purchase_attempt'
  | 'purchase_completed'
  | 'flow_completed'
  | 'error';

// Analytics data structure
export interface AnalyticsEvent {
  ip_address: string;
  wallet_address?: string;
  event_type: EventType;
  stage_number?: number;
  success: boolean;
  error_message?: string;
  tx_hash?: string;
  metadata?: Record<string, any>;
}

// Track event with automatic KV fallback
export async function trackEvent(
  request: NextRequest,
  event: Omit<AnalyticsEvent, 'ip_address'>
): Promise<void> {
  const ip = getClientIP(request);
  const geoInfo = getGeoInfo(request);
  
  const fullEvent: AnalyticsEvent = {
    ...event,
    ip_address: ip,
    metadata: {
      ...event.metadata,
      geo: geoInfo,
      user_agent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      timestamp: new Date().toISOString()
    }
  };

  // Try Supabase first
  if (supabase) {
    try {
      const { error } = await supabase
        .from('wallet_events')
        .insert({
          ip_address: fullEvent.ip_address,
          event_type: fullEvent.event_type,
          metadata: {
            wallet_address: fullEvent.wallet_address,
            stage_number: fullEvent.stage_number,
            success: fullEvent.success,
            error_message: fullEvent.error_message,
            tx_hash: fullEvent.tx_hash,
            ...fullEvent.metadata
          }
        });

      if (error) {
        console.error('Supabase insert error:', error);
        await kvFallback(fullEvent);
      }
    } catch (err) {
      console.error('Supabase connection error:', err);
      await kvFallback(fullEvent);
    }
  } else {
    // No Supabase configured, use KV directly
    await kvFallback(fullEvent);
  }
}

// KV fallback for when Supabase fails
async function kvFallback(event: AnalyticsEvent): Promise<void> {
  try {
    // Use timestamp + performance.now() + random to avoid collisions
    const timestamp = Date.now();
    const perfTime = typeof performance !== 'undefined' ? performance.now() : 0;
    const random = Math.random().toString(36).slice(2);
    const key = `analytics:${event.event_type}:${timestamp}:${perfTime}:${random}`;
    await kv.set(key, event); // No expiry - permanent storage
    console.log('Event stored in KV fallback:', key);
  } catch (kvError) {
    console.error('KV fallback failed:', kvError);
    // Last resort - just log it
    console.log('FAILED_ANALYTICS:', JSON.stringify(event));
  }
}

// Helper functions for specific tracking stages

export async function trackGenerateAttempt(request: NextRequest): Promise<void> {
  await trackEvent(request, {
    event_type: 'generate_account_attempt',
    stage_number: 1,
    success: true  // Attempts are neutral, not success/failure
  });
}

export async function trackWalletGenerated(
  request: NextRequest,
  walletAddress: string,
  index: number
): Promise<void> {
  await trackEvent(request, {
    event_type: 'wallet_generated',
    wallet_address: walletAddress,
    stage_number: 2,
    success: true,
    metadata: { index }
  });
}

export async function trackWalletFunded(
  request: NextRequest,
  walletAddress: string,
  payTx: string,
  approveTx: string
): Promise<void> {
  await trackEvent(request, {
    event_type: 'wallet_funded',
    wallet_address: walletAddress,
    stage_number: 3,
    success: true,
    tx_hash: payTx,
    metadata: { approve_tx: approveTx }
  });
}

export async function trackPurchaseAttempt(
  request: NextRequest,
  walletAddress: string
): Promise<void> {
  await trackEvent(request, {
    event_type: 'purchase_attempt',
    wallet_address: walletAddress,
    stage_number: 4,
    success: true
  });
}

export async function trackPurchaseCompleted(
  request: NextRequest,
  walletAddress: string,
  txHash: string,
  transactions: any[]
): Promise<void> {
  await trackEvent(request, {
    event_type: 'purchase_completed',
    wallet_address: walletAddress,
    stage_number: 5,
    success: true,
    tx_hash: txHash,
    metadata: { transactions }
  });
}

export async function trackFlowCompleted(
  request: NextRequest,
  walletAddress: string,
  giftCardPurchased: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  await trackEvent(request, {
    event_type: 'flow_completed',
    wallet_address: walletAddress,
    stage_number: 6,
    success: true,
    metadata: {
      gift_card_purchased: giftCardPurchased,
      ...metadata
    }
  });
}

export async function trackError(
  request: NextRequest,
  eventType: EventType,
  error: string,
  walletAddress?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await trackEvent(request, {
    event_type: eventType,
    wallet_address: walletAddress,
    success: false,
    error_message: error,
    metadata
  });
}

// Quick stats functions that only use KV (for speed)
export async function incrementCounter(key: string): Promise<void> {
  try {
    await kv.incr(key);
  } catch (err) {
    console.error(`Failed to increment ${key}:`, err);
  }
}

export async function addToSet(key: string, value: string): Promise<void> {
  try {
    await kv.sadd(key, value);
  } catch (err) {
    console.error(`Failed to add to set ${key}:`, err);
  }
}

export async function pushToList(key: string, value: any, maxLength: number = 100): Promise<void> {
  try {
    await kv.lpush(key, JSON.stringify(value));
    await kv.ltrim(key, 0, maxLength - 1);
  } catch (err) {
    console.error(`Failed to push to list ${key}:`, err);
  }
}

// Get user journey for a specific IP or wallet
export async function getUserJourney(identifier: string): Promise<any[]> {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('wallet_events')
      .select('*')
      .or(`ip_address.eq.${identifier},metadata->>'wallet_address'.eq.${identifier}`)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Failed to get user journey:', err);
    return [];
  }
}