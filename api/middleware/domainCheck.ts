import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Add your allowed domains here
const ALLOWED_DOMAINS = [
  'https://yourfrontend.com',
  'https://partnerdomain.com',
  'http://localhost:3000', // for development
];

export function checkDomain(req: VercelRequest): boolean {
  const origin = req.headers.origin || req.headers.referer;
  
  if (!origin) return false;
  
  return ALLOWED_DOMAINS.some(allowed => origin.startsWith(allowed));
}

// Combined domain check + rate limiting
export async function protectEndpoint(
  req: VercelRequest,
  res: VercelResponse,
  next: () => Promise<any>
) {
  // 1. Check domain first (fast, no DB call)
  if (!checkDomain(req)) {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'API access not allowed from this domain'
    });
  }
  
  // 2. Rate limit per IP
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';
  const key = `rate:${ip}`;
  
  // Simple sliding window rate limit
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, 3600); // Reset after 1 hour
  }
  
  if (count > 10) { // 10 requests per hour per IP
    return res.status(429).json({ 
      error: 'Too many requests',
      message: 'Please try again later'
    });
  }
  
  // 3. Add CORS headers for allowed domain
  const origin = req.headers.origin;
  if (origin && ALLOWED_DOMAINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  
  return next();
}