import { NextResponse } from 'next/server';

// Configure allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.ALLOWED_ORIGIN, // Add custom origins via env
].filter(Boolean);

export function corsHeaders(origin: string | null) {
  // Allow all origins in development, or check against allowed list
  const isAllowed = process.env.NODE_ENV === 'development' || 
                    !origin || 
                    allowedOrigins.includes(origin) ||
                    origin?.endsWith('.vercel.app'); // Allow all Vercel preview deployments

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(request: Request) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers });
  }
  
  return headers;
}