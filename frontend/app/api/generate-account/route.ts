import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits
} from 'viem';
import { sophonTestnet } from '../../config/chains';
import { kv } from '@vercel/kv';
import { createClient } from '@supabase/supabase-js';
import jobsAbi from '../../abi/jobsV2.json';
import { corsHeaders } from '../cors';

const MNEMONIC = process.env.MNEMONIC!;
const JOBS_CONTRACT = (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0x935f8Fd143720B337c521354a545a342DF584D18') as `0x${string}`;
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';

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
        // Get IP address for basic tracking
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown';
        
        const index = await kv.get('wallet_index') || 0;

        // Derive new wallet for the user
        const recipient = mnemonicToAccount(MNEMONIC, {
            path: `m/44'/60'/0'/0/${index}`
        });

        // increment wallet index
        await kv.incr("wallet_index");

        // Use deployer wallet to call Jobs contract
        const distributor = privateKeyToAccount(`0x${process.env.WALLET_PRIVATE_KEY!}`);

        const client = createWalletClient({
            account: distributor,
            chain: sophonTestnet,
            transport: http(RPC_URL)
        });

        const publicClient = createPublicClient({
            chain: sophonTestnet,
            transport: http(RPC_URL)
        });

        // Get nonce for distributor
        const confirmedNonce = await publicClient.getTransactionCount({
            address: distributor.address,
            blockTag: 'latest'
        });

        // Call Jobs contract to pay the new user with USDC only
        const usdcAmount = parseUnits('0.01', 6); // 0.01 USDC
        const sophTokenAmount = 0n; // Don't send SOPH ERC20 token

        // Execute payUser on Jobs contract (this sends USDC)
        const txHash = await client.writeContract({
            address: JOBS_CONTRACT,
            abi: jobsAbi,
            functionName: 'payUser',
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
                    funded_usdc: '0.01',
                    funded_soph: '1'
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
            jobsContract: JOBS_CONTRACT,
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