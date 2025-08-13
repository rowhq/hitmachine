import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits
} from 'viem';
import { sophonTestnet, sophonMainnet } from '../../config/chains';
import { kv } from '@vercel/kv';
import { createClient } from '@supabase/supabase-js';
import jobsAbi from '../../abi/jobsV2.json';
import { corsHeaders } from '../cors';

const MNEMONIC = process.env.MNEMONIC!;

// Determine network from query parameter
function getNetworkConfig(request: NextRequest) {
    const url = new URL(request.url);
    const isTestnet = url.searchParams.has('testnet');
    
    if (isTestnet) {
        return {
            chain: sophonTestnet,
            jobsContract: (process.env.NEXT_PUBLIC_TESTNET_JOBS_CONTRACT || '0x935f8Fd143720B337c521354a545a342DF584D18') as `0x${string}`,
            rpcUrl: 'https://rpc.testnet.sophon.xyz',
            network: 'testnet'
        };
    } else {
        return {
            chain: sophonMainnet,
            jobsContract: (process.env.NEXT_PUBLIC_MAINNET_JOBS_CONTRACT || process.env.NEXT_PUBLIC_JOBS_CONTRACT || '') as `0x${string}`,
            rpcUrl: process.env.MAINNET_RPC_URL || 'https://rpc.sophon.xyz',
            network: 'mainnet'
        };
    }
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, '') || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, '') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
    const headers = corsHeaders();
    
    try {
        // Get network configuration
        const config = getNetworkConfig(request);
        
        // Get IP address for basic tracking
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown';
        
        const indexKey = `wallet_index_${config.network}`;
        const index = await kv.get(indexKey) || 0;

        // Derive new wallet for the user
        const recipient = mnemonicToAccount(MNEMONIC, {
            path: `m/44'/60'/0'/0/${index}`
        });

        // increment wallet index
        await kv.incr(indexKey);

        // Use deployer wallet to call Jobs contract
        const distributor = privateKeyToAccount(`0x${process.env.WALLET_PRIVATE_KEY!}`);

        const client = createWalletClient({
            account: distributor,
            chain: config.chain,
            transport: http(config.rpcUrl)
        });

        const publicClient = createPublicClient({
            chain: config.chain,
            transport: http(config.rpcUrl)
        });

        // Get nonce for distributor
        const confirmedNonce = await publicClient.getTransactionCount({
            address: distributor.address,
            blockTag: 'latest'
        });

        // Call Jobs contract to pay the new user with USDC only
        const usdcAmount = BigInt(32e6); // 32 USDC (32e6 = 32,000,000 units with 6 decimals)
        const sophTokenAmount = 0n; // Don't send SOPH ERC20 token

        // Execute payCatFeeder on Jobs contract (this sends USDC)
        const txHash = await client.writeContract({
            address: config.jobsContract,
            abi: jobsAbi,
            functionName: 'payCatFeeder',
            args: [recipient.address, usdcAmount, sophTokenAmount],
            nonce: confirmedNonce
        });

        // Wait for transaction confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        // Send 2 native SOPH for gas fees directly (enough for approval + purchase)
        const gasAmount = parseUnits('2', 18); // 2 native SOPH for gas
        const gasTxHash = await client.sendTransaction({
            to: recipient.address,
            value: gasAmount,
            nonce: confirmedNonce + 1
        });

        // Wait for gas transaction confirmation
        const gasReceipt = await publicClient.waitForTransactionReceipt({ hash: gasTxHash });

        // Store address => index mapping in KV
        await kv.set(`wallet_address_to_index:${recipient.address.toLowerCase()}`, index);
        
        // Track to Supabase
        try {
            await supabase.from('wallet_events').insert({
                ip_address: ip,
                event_type: 'wallet_generated',
                metadata: {
                    wallet_address: recipient.address,
                    index,
                    funded_usdc: '32',
                    funded_soph: '2'
                }
            });
        } catch (supabaseError) {
            console.log('Supabase tracking error:', supabaseError);
        }
        
        // Basic analytics tracking in KV
        await kv.sadd('unique_ips', ip);
        await kv.incr('total_wallets_generated');
        await kv.lpush('recent_wallets', JSON.stringify({
            address: recipient.address,
            ip,
            timestamp: new Date().toISOString(),
            index
        }));
        await kv.ltrim('recent_wallets', 0, 99); // Keep last 100

        return NextResponse.json({
            message: 'Account created and funded',
            address: recipient.address,
            index,
            txHash,
            gasTxHash,
            fundedWith: {
                usdc: '0.01 USDC (from Jobs contract)',
                soph: '2 SOPH (native for gas)'
            },
            jobsContract: config.jobsContract,
            status: receipt.status === 'success' && gasReceipt.status === 'success' ? 'success' : 'failed'
        }, { headers });
    } catch (err: any) {
        console.error('Generate account error:', err);
        
        return NextResponse.json(
            { error: err.message || 'Unexpected error' },
            { status: 500, headers }
        );
    }
}