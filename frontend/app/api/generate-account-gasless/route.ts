import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { parseUnits } from 'viem';
import { Provider, Wallet, utils } from 'zksync-ethers';
import { ethers } from 'ethers';
import { kv } from '@vercel/kv';
import { createClient } from '@supabase/supabase-js';
import jobsAbi from '../../abi/jobsV2.json';
import { corsHeaders } from '../cors';

const MNEMONIC = process.env.MNEMONIC!;
const JOBS_CONTRACT = (process.env.NEXT_PUBLIC_JOBS_CONTRACT || '0x8C0Bf03D2D5Da94cE3f1A1FC30Ad142615a8382A') as `0x${string}`;
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0xCF0B96c99785805014c6e1a66399F567367799c2') as `0x${string}`;
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';
const PAYMASTER_ADDRESS = '0x98546B226dbbA8230cf620635a1e4ab01F6A99B2';

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
        // Get IP address for tracking
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

        // Initialize zkSync provider and wallet
        const provider = new Provider(RPC_URL);
        const zkWallet = new Wallet(process.env.WALLET_PRIVATE_KEY!, provider);

        // Prepare Jobs contract call with paymaster
        const usdcAmount = parseUnits('0.01', 6); // 0.01 USDC
        const sophTokenAmount = 0n; // Don't send SOPH ERC20 token

        // Encode the function call
        const jobsInterface = new ethers.Interface(jobsAbi);
        const calldata = jobsInterface.encodeFunctionData('payUser', [
            recipient.address,
            usdcAmount,
            sophTokenAmount
        ]);

        // Try ApprovalBased paymaster flow
        const paymasterParams = utils.getPaymasterParams(PAYMASTER_ADDRESS, {
            type: 'ApprovalBased',
            token: USDC_ADDRESS, // Try using USDC as payment token
            minimalAllowance: BigInt(1), // Minimal amount
            innerInput: new Uint8Array()
        });

        // Create transaction with paymaster parameters
        const tx = {
            to: JOBS_CONTRACT,
            data: calldata,
            value: 0n,
            customData: {
                paymasterParams
            }
        };

        // Send transaction with paymaster (Jobs contract sends USDC)
        console.log('Sending gasless transaction with paymaster...');
        const txResponse = await zkWallet.sendTransaction(tx);
        const receipt = await txResponse.wait();
        
        console.log('Gasless transaction successful:', receipt.hash);

        // Send native SOPH for gas (this still needs gas but only once)
        const gasAmount = parseUnits('2', 18); // 2 native SOPH for gas
        const gasTx = await zkWallet.sendTransaction({
            to: recipient.address,
            value: gasAmount,
            // No paymaster for this one as it's just a value transfer
        });
        const gasReceipt = await gasTx.wait();

        // Store address => index mapping in KV
        await kv.set(`wallet_address_to_index:${recipient.address.toLowerCase()}`, index);
        
        // Track to Supabase
        try {
            await supabase.from('wallet_events').insert({
                ip_address: ip,
                event_type: 'wallet_generated_gasless',
                metadata: {
                    wallet_address: recipient.address,
                    index,
                    funded_usdc: '0.01',
                    funded_soph: '2',
                    paymaster_used: true
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
            index,
            gasless: true
        }));
        await kv.ltrim('recent_wallets', 0, 99); // Keep last 100

        return NextResponse.json({
            message: 'Account created and funded (GASLESS with Paymaster)',
            address: recipient.address,
            index,
            txHash: receipt.hash,
            gasTxHash: gasReceipt.hash,
            fundedWith: {
                usdc: '0.01 USDC (from Jobs contract via Paymaster)',
                soph: '2 SOPH (native for gas)'
            },
            jobsContract: JOBS_CONTRACT,
            paymaster: PAYMASTER_ADDRESS,
            gasless: true,
            status: receipt.status === 1 && gasReceipt.status === 1 ? 'success' : 'failed'
        }, { headers });
    } catch (err: any) {
        console.error('Generate account gasless error:', err);
        
        return NextResponse.json(
            { error: err.message || 'Unexpected error' },
            { status: 500, headers }
        );
    }
}