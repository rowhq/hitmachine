import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http } from 'viem';
import { sophonTestnet } from '../../config/chains';
import storeAbi from '../../abi/storeV2.json';
import { corsHeaders } from '../cors';

const MNEMONIC = process.env.MNEMONIC!;
const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';
const MASS_BUY_API_KEY = process.env.MASS_BUY_API_KEY;

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders();
  
  // Check API key for security
  const apiKey = request.headers.get('x-api-key');
  if (MASS_BUY_API_KEY && apiKey !== MASS_BUY_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers }
    );
  }

  try {
    const { startIndex, endIndex } = await request.json();
    
    if (!startIndex || !endIndex) {
      return NextResponse.json(
        { 
          error: 'Missing parameters',
          message: 'Provide startIndex and endIndex' 
        },
        { status: 400, headers }
      );
    }
    
    const start = parseInt(startIndex);
    const end = parseInt(endIndex);
    
    if (isNaN(start) || isNaN(end) || start < 0 || end < start) {
      return NextResponse.json(
        { 
          error: 'Invalid parameters',
          message: 'Indices must be valid positive integers with end >= start' 
        },
        { status: 400, headers }
      );
    }
    
    if (end - start > 50) {
      return NextResponse.json(
        { 
          error: 'Too many wallets',
          message: 'Maximum 50 wallets per request' 
        },
        { status: 400, headers }
      );
    }
    
    const publicClient = createPublicClient({
      chain: sophonTestnet,
      transport: http(RPC_URL)
    });
    
    const results = [];
    const errors = [];
    
    // Process each wallet
    for (let i = start; i <= end; i++) {
      try {
        const account = mnemonicToAccount(MNEMONIC, {
          path: `m/44'/60'/0'/0/${i}`
        });
        
        // Check if already purchased
        const hasPurchased = await publicClient.readContract({
          address: STORE_CONTRACT,
          abi: storeAbi,
          functionName: 'hasPurchased',
          args: [account.address],
        }) as boolean;
        
        if (hasPurchased) {
          results.push({
            index: i,
            address: account.address,
            status: 'already_purchased',
            skipped: true
          });
          continue;
        }
        
        // Create wallet client for this account
        const walletClient = createWalletClient({
          account,
          chain: sophonTestnet,
          transport: http(RPC_URL)
        });
        
        // Execute purchase
        const hash = await walletClient.writeContract({
          address: STORE_CONTRACT,
          abi: storeAbi,
          functionName: 'buyAlbum'
        });
        
        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ 
          hash,
          confirmations: 1 
        });
        
        results.push({
          index: i,
          address: account.address,
          status: 'success',
          txHash: hash,
          blockNumber: receipt.blockNumber
        });
        
      } catch (error: any) {
        errors.push({
          index: i,
          error: error.message
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      processed: end - start + 1,
      successful: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.skipped).length,
      failed: errors.length,
      results,
      errors
    }, { headers });
    
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Mass buy failed',
        details: error.message
      },
      { status: 500, headers }
    );
  }
}