import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export async function checkRateLimit(
  req: VercelRequest,
  limits: {
    requests: number;  // max requests
    window: number;    // time window in seconds
  }
): Promise<{ success: boolean; remaining: number; reset: number }> {
  
  // Get IP address
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
             req.headers['x-real-ip'] as string || 
             'unknown';
  
  const key = `rate_limit:${ip}`;
  const now = Date.now();
  const window = limits.window * 1000; // Convert to milliseconds
  
  // Get current count and timestamp
  const data = await kv.get<{ count: number; resetAt: number }>(key);
  
  // If no data or window expired, start fresh
  if (!data || now > data.resetAt) {
    const resetAt = now + window;
    await kv.set(key, { count: 1, resetAt }, { px: window });
    
    return {
      success: true,
      remaining: limits.requests - 1,
      reset: resetAt
    };
  }
  
  // Check if limit exceeded
  if (data.count >= limits.requests) {
    return {
      success: false,
      remaining: 0,
      reset: data.resetAt
    };
  }
  
  // Increment counter
  await kv.set(
    key, 
    { count: data.count + 1, resetAt: data.resetAt },
    { px: data.resetAt - now } // Expire at reset time
  );
  
  return {
    success: true,
    remaining: limits.requests - data.count - 1,
    reset: data.resetAt
  };
}

// Simple middleware wrapper
export function withRateLimit(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<any>,
  limits = { requests: 10, window: 3600 } // Default: 10 requests per hour
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const { success, remaining, reset } = await checkRateLimit(req, limits);
    
    // Add headers
    res.setHeader('X-RateLimit-Limit', limits.requests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(reset).toISOString());
    
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      return res.status(429).json({
        error: 'Too many requests',
        message: `Please wait ${retryAfter} seconds before trying again`,
        retryAfter
      });
    }
    
    return handler(req, res);
  };
}