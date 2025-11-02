/**
 * Price API Endpoint
 * Returns the current gift card price from the contract
 */

import { NextRequest, NextResponse } from "next/server";
import { getGiftCardPrice, formatGiftCardPrice } from "../../utils/price-service";
import { corsHeaders } from "../cors";
import { NETWORK } from "../../config/environment";

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders();

  try {
    // Fetch the current price from the contract
    const price = await getGiftCardPrice();
    const priceDisplay = formatGiftCardPrice(price);

    return NextResponse.json(
      {
        price: price.toString(),
        priceDisplay,
        priceUSDC: Number(price) / 1e6,
        network: NETWORK,
        timestamp: new Date().toISOString()
      },
      { status: 200, headers }
    );
  } catch (error: any) {
    console.error('Error fetching price:', error);
    return NextResponse.json(
      {
        error: "Failed to fetch price from contract",
        details: error.message
      },
      { status: 500, headers }
    );
  }
}
