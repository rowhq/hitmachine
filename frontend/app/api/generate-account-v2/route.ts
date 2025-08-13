import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { sophonTestnet, sophonMainnet } from '../../config/chains';
import { kv } from '@vercel/kv';
import { createClient } from '@supabase/supabase-js';
import jobsAbi from '../../abi/jobsV2.json';
import { corsHeaders } from '../cors';
import { getNetworkConfig } from '../utils/network';

const MNEMONIC = process.env.MNEMONIC!;

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
        const chain = config.network === 'mainnet' ? sophonMainnet : sophonTestnet;
        
        // Get IP address for tracking
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown';
        
        // Get wallet index (shared between networks but tracked separately)
        const indexKey = `wallet_index_${config.network}`;
        const index = await kv.get(indexKey) || 0;

        // Derive new wallet for the user
        const recipient = mnemonicToAccount(MNEMONIC, {
            path: `m/44'/60'/0'/0/${index}`
        });

        // Increment wallet index for this network
        await kv.incr(indexKey);

        // Use deployer wallet to call Jobs contract
        const distributor = privateKeyToAccount(`0x${process.env.WALLET_PRIVATE_KEY!}`);

        // Create wallet client for the distributor
        const client = createWalletClient({
            account: distributor,
            chain,
            transport: http(config.rpcUrl),
        });

        // Create public client for reading
        const publicClient = createPublicClient({
            chain,
            transport: http(config.rpcUrl),
        });

        // Get current nonce
        const nonce = await publicClient.getTransactionCount({
            address: distributor.address,
        });

        // Call Jobs contract to send USDC and SOPH to the new wallet
        const usdcAmount = parseUnits('0.01', 6); // 0.01 USDC
        const sophTokenAmount = parseUnits('0', 18); // No SOPH token, just native

        // Execute payUser on Jobs contract
        const txHash = await client.writeContract({
            address: config.contracts.jobs as `0x${string}`,
            abi: jobsAbi,
            functionName: 'payUser',
            args: [recipient.address, usdcAmount, sophTokenAmount],
            nonce,
        });

        // Send native SOPH for gas
        const gasAmount = parseUnits('2', 18); // 2 native SOPH for gas
        const gasTxHash = await client.sendTransaction({
            to: recipient.address,
            value: gasAmount,
            nonce: nonce + 1,
        });

        // Wait for transactions
        const [jobsReceipt, gasReceipt] = await Promise.all([
            publicClient.waitForTransactionReceipt({ hash: txHash }),
            publicClient.waitForTransactionReceipt({ hash: gasTxHash }),
        ]);

        // Store address => index mapping in KV
        await kv.set(`wallet_address_to_index_${config.network}:${recipient.address.toLowerCase()}`, index);
        
        // Track to Supabase with network info
        try {
            await supabase.from('wallet_events').insert({
                ip_address: ip,
                event_type: 'wallet_generated',
                network: config.network,
                metadata: {
                    wallet_address: recipient.address,
                    index,
                    funded_usdc: '0.01',
                    funded_soph: '2',
                    jobs_contract: config.contracts.jobs,
                }
            });
        } catch (supabaseError) {
            console.log('Supabase tracking error:', supabaseError);
        }
        
        // Basic analytics tracking in KV
        await kv.sadd(`unique_ips_${config.network}`, ip);
        await kv.incr(`total_wallets_generated_${config.network}`);
        await kv.lpush(`recent_wallets_${config.network}`, JSON.stringify({
            address: recipient.address,
            ip,
            timestamp: new Date().toISOString(),
            index,
            network: config.network,
        }));
        await kv.ltrim(`recent_wallets_${config.network}`, 0, 99); // Keep last 100

        return NextResponse.json({
            message: 'Account created and funded',
            address: recipient.address,
            index,
            network: config.network,
            txHash,
            gasTxHash,
            fundedWith: {
                usdc: '0.01 USDC (from Jobs contract)',
                soph: '2 SOPH (native for gas)'
            },
            jobsContract: config.contracts.jobs,
            explorer: `${chain.blockExplorers.default.url}/address/${recipient.address}`,
        }, { headers });
    } catch (err: any) {
        console.error('Generate account error:', err);
        
        return NextResponse.json(
            { error: err.message || 'Unexpected error' },
            { status: 500, headers }
        );
    }
}