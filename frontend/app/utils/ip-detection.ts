import { NextRequest } from "next/server";

/**
 * Comprehensive IP detection for Vercel serverless functions
 * Checks multiple headers in priority order to handle various proxy/CDN scenarios
 */
export function getClientIP(request: NextRequest): string {
  // Priority order for IP headers (most reliable first)
  const headers = [
    'cf-connecting-ip',        // Cloudflare (most reliable when using CF)
    'x-real-ip',              // Nginx proxy
    'x-forwarded-for',        // Standard proxy (can be spoofed)
    'x-client-ip',            // Some proxies
    'true-client-ip',         // Akamai, Cloudflare Enterprise
    'x-vercel-forwarded-for', // Vercel specific
    'x-vercel-ip-city',       // Vercel specific
    'fastly-client-ip',       // Fastly CDN
    'x-azure-clientip',       // Azure
    'x-original-forwarded-for', // AWS ALB
    'x-forwarded',            // General forward
    'forwarded-for',          // RFC 7239
    'x-cluster-client-ip'     // Some load balancers
  ];

  // Try each header in order
  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // Handle comma-separated values (multiple proxies)
      // First IP is usually the original client
      const ips = value.split(',').map(ip => ip.trim());
      const clientIp = ips[0];
      
      // Basic validation - ensure it looks like an IP
      if (clientIp && isValidIP(clientIp)) {
        return clientIp.toLowerCase();
      }
    }
  }

  // Last resort - check request object directly (rarely works in serverless)
  const socketIp = (request as any).socket?.remoteAddress || 
                   (request as any).connection?.remoteAddress ||
                   (request as any).ip;
  
  if (socketIp) {
    // Remove IPv6 prefix if present
    const cleanIp = socketIp.replace(/^::ffff:/, '');
    if (isValidIP(cleanIp)) {
      return cleanIp.toLowerCase();
    }
  }

  return 'unknown';
}

/**
 * Validate if string looks like an IP address
 */
function isValidIP(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(ip)) {
    // Check each octet is <= 255
    const octets = ip.split('.');
    return octets.every(octet => parseInt(octet) <= 255);
  }
  
  // IPv6 pattern (simplified - just check for colons)
  if (ip.includes(':')) {
    // Basic IPv6 validation
    return /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
  }
  
  return false;
}

/**
 * Get all IP-related headers for debugging/logging
 */
export function getAllIPHeaders(request: NextRequest): Record<string, string | null> {
  const ipHeaders = [
    'cf-connecting-ip',
    'x-real-ip',
    'x-forwarded-for',
    'x-client-ip',
    'true-client-ip',
    'x-vercel-forwarded-for',
    'x-vercel-ip-city',
    'fastly-client-ip',
    'x-azure-clientip',
    'x-original-forwarded-for',
    'x-forwarded',
    'forwarded-for',
    'x-cluster-client-ip'
  ];

  const headers: Record<string, string | null> = {};
  for (const header of ipHeaders) {
    headers[header] = request.headers.get(header);
  }
  
  return headers;
}

/**
 * Get geo information from headers (if available)
 */
export function getGeoInfo(request: NextRequest): {
  country?: string;
  city?: string;
  region?: string;
} {
  return {
    country: request.headers.get('cf-ipcountry') || 
             request.headers.get('x-vercel-ip-country') || 
             undefined,
    city: request.headers.get('x-vercel-ip-city') || 
          undefined,
    region: request.headers.get('x-vercel-ip-country-region') || 
            undefined,
  };
}