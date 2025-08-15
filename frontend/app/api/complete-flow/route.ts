import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { kv } from "@vercel/kv";
import { corsHeaders } from "../cors";
import { getClientIP, getAllIPHeaders, getGeoInfo } from "../../utils/ip-detection";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, "") || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, "") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);


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

    // Get geo information
    const geoInfo = getGeoInfo(request);
    
    // Primary storage in Supabase
    try {
      const { data, error } = await supabase.from("flow_completions").insert({
        ip_address: ip,
        wallet_address: walletAddress?.toLowerCase(),
        gift_card_purchased: giftCardPurchased,
        user_agent: userAgent,
        referer: referer,
        metadata: {
          ...metadata,
          geo: geoInfo,
          headers: getAllIPHeaders(request)
        },
        completed_at: new Date().toISOString()
      }).select();

      if (error) throw error;

      // Only use KV for quick analytics (non-critical)
      Promise.all([
        kv.sadd("completed_flow_ips", ip),
        kv.incr("total_flow_completions"),
        kv.incr(giftCardPurchased ? "total_purchases_completed" : "total_flows_without_purchase")
      ]).catch(err => console.error("KV analytics error:", err));

      return NextResponse.json(
        {
          success: true,
          message: "Flow completion tracked successfully",
          ip: ip,
          id: data?.[0]?.id
        },
        { headers }
      );

    } catch (supabaseError) {
      console.error("Supabase error:", supabaseError);
      
      // Fallback to KV only if Supabase fails
      try {
        const fallbackKey = `flow_completion:${Date.now()}:${ip}`;
        await kv.set(fallbackKey, {
          ip,
          walletAddress,
          giftCardPurchased,
          userAgent,
          referer,
          timestamp: new Date().toISOString()
        }, { ex: 86400 * 30 }); // 30 day expiry

        return NextResponse.json(
          {
            success: true,
            message: "Flow completion tracked (fallback)",
            ip: ip,
            storage: "kv_fallback"
          },
          { headers }
        );
      } catch (kvError) {
        throw kvError;
      }
    }

  } catch (err: any) {
    console.error("Complete flow error:", err);
    
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