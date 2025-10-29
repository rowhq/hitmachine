import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { corsHeaders } from "../cors";
import { getClientIP, getAllIPHeaders } from "../../utils/ip-detection";
import { trackFlowCompleted, trackError, incrementCounter } from "../../utils/analytics-service";
import { NETWORK } from "../../config/environment";


export async function POST(request: NextRequest) {
  const headers = corsHeaders();

  try {
    // Get client IP with comprehensive detection
    const ip = getClientIP(request);
    
    // Get request body
    const body = await request.json();
    const { 
      walletAddress, 
      giftCardPurchased = false,
      metadata = {} 
    } = body;

    // Validate wallet address
    if (!walletAddress) {
      await trackError(request, 'flow_completed', 'Wallet address is required');
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400, headers }
      );
    }

    // Get user agent and other headers for additional tracking
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const referer = request.headers.get('referer') || 'direct';
    
    // Log all headers in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Flow completion - Headers:', Object.fromEntries(request.headers.entries()));
      console.log('Flow completion - Detected IP:', ip);
    }

    // Simple rate limiting - 30 completions per minute per IP
    const rateLimitKey = `complete:${ip}:${Math.floor(Date.now() / 60000)}`;
    const requests = await kv.incr(rateLimitKey);
    await kv.expire(rateLimitKey, 120); // Expire after 2 minutes
    
    if (requests > 30) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: 60
        },
        { status: 429, headers }
      );
    }

    // Track flow completion using unified analytics
    await trackFlowCompleted(request, walletAddress, giftCardPurchased, {
      ...metadata,
      user_agent: userAgent,
      referer: referer,
      headers: getAllIPHeaders(request)
    });

    // Additional KV analytics (network-specific)
    await Promise.all([
      kv.sadd(`completed_flow_ips_${NETWORK}`, ip),
      incrementCounter(`total_flow_completions_${NETWORK}`),
      incrementCounter(giftCardPurchased ? `total_purchases_completed_${NETWORK}` : `total_flows_without_purchase_${NETWORK}`)
    ]);

    return NextResponse.json(
      {
        success: true,
        message: "Flow completion tracked successfully",
        ip: ip
      },
      { headers }
    );

  } catch (err: any) {
    console.error("Complete flow error:", err);
    
    // Track the error
    await trackError(request, 'flow_completed', err.message || "Failed to track flow completion");
    
    return NextResponse.json(
      {
        error: "Failed to track flow completion",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500, headers }
    );
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}