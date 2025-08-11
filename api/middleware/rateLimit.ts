import { kv } from '@vercel/kv';
import type { VercelRequest } from '@vercel/node';

// Balanced rate limiting that won't hurt legitimate users
export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    skipSuccessfulRequests?: boolean; // Don't count successful purchases against limit
    keyGenerator?: (req: VercelRequest) => string;
}

const configs: Record<string, RateLimitConfig> = {
    'generate-account': {
        maxRequests: 5, // 5 wallet creations
        windowMs: 60 * 60 * 1000, // per hour
        skipSuccessfulRequests: false,
    },
    'purchase-album': {
        maxRequests: 20, // 20 attempts
        windowMs: 60 * 60 * 1000, // per hour  
        skipSuccessfulRequests: true, // Only count failures
    },
    'default': {
        maxRequests: 100,
        windowMs: 60 * 1000, // per minute
        skipSuccessfulRequests: false,
    }
};

function getClientIdentifier(req: VercelRequest): string {
    // Use multiple factors for better identification without being too strict
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
               req.headers['x-real-ip'] as string || 
               'unknown';
    
    // For logged-in users, you could use their user ID instead
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
        return `user:${userId}`;
    }
    
    // For anonymous users, use IP but be lenient
    return `ip:${ip}`;
}

export async function checkRateLimit(
    req: VercelRequest,
    endpoint: string,
    success: boolean = false
): Promise<{ allowed: boolean; retryAfter?: number; remaining?: number }> {
    const config = configs[endpoint] || configs.default;
    const identifier = getClientIdentifier(req);
    const key = `rate_limit:${endpoint}:${identifier}`;
    
    // Get current window data
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Get request history
    let requests = await kv.zrange<number[]>(key, windowStart, now);
    if (!requests) requests = [];
    
    // Clean old entries
    await kv.zremrangebyscore(key, 0, windowStart);
    
    // Check if we should count this request
    const shouldCount = !config.skipSuccessfulRequests || !success;
    
    // Current request count
    const currentCount = requests.length;
    
    if (currentCount >= config.maxRequests) {
        // Calculate retry after
        const oldestRequest = requests[0];
        const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
        
        return {
            allowed: false,
            retryAfter,
            remaining: 0
        };
    }
    
    // Add current request if we should count it
    if (shouldCount) {
        await kv.zadd(key, { score: now, member: now });
        await kv.expire(key, Math.ceil(config.windowMs / 1000));
    }
    
    return {
        allowed: true,
        remaining: config.maxRequests - currentCount - (shouldCount ? 1 : 0)
    };
}

// Soft rate limiting with progressive delays
export async function getSoftDelay(
    req: VercelRequest,
    endpoint: string
): Promise<number> {
    const identifier = getClientIdentifier(req);
    const key = `soft_delay:${endpoint}:${identifier}`;
    
    // Get recent request count
    const recentCount = await kv.incr(key);
    await kv.expire(key, 60); // Reset every minute
    
    // Progressive delay: 0ms, 100ms, 500ms, 1000ms, 2000ms...
    if (recentCount <= 1) return 0;
    if (recentCount <= 3) return 100;
    if (recentCount <= 5) return 500;
    if (recentCount <= 10) return 1000;
    return Math.min(recentCount * 200, 5000); // Cap at 5 seconds
}

// Reputation system for good users
export async function getUserReputation(identifier: string): Promise<number> {
    const key = `reputation:${identifier}`;
    const rep = await kv.get<number>(key);
    return rep || 0;
}

export async function updateReputation(
    identifier: string,
    delta: number
): Promise<void> {
    const key = `reputation:${identifier}`;
    const current = await kv.get<number>(key) || 0;
    const newRep = Math.max(0, Math.min(100, current + delta));
    await kv.set(key, newRep, { ex: 30 * 24 * 60 * 60 }); // 30 days
}

// Smart detection that learns from patterns
export async function detectAbuse(req: VercelRequest): Promise<boolean> {
    const identifier = getClientIdentifier(req);
    
    // Check reputation first - good users get a pass
    const reputation = await getUserReputation(identifier);
    if (reputation > 50) return false; // Trusted user
    
    // Simple heuristics that won't affect normal users
    const suspicious = [
        // No user agent is definitely suspicious
        !req.headers['user-agent'],
        // Known bot patterns
        /bot|crawler|spider|scraper|python|curl|wget/i.test(req.headers['user-agent'] || ''),
        // Very new user with high activity
        reputation === 0 && await isHighActivity(identifier),
    ].filter(Boolean);
    
    return suspicious.length >= 2;
}

async function isHighActivity(identifier: string): Promise<boolean> {
    // Check if user has made many requests very quickly
    const key = `activity:${identifier}`;
    const count = await kv.incr(key);
    await kv.expire(key, 300); // 5 minute window
    
    return count > 10; // More than 10 requests in 5 minutes for new user
}