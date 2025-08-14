import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatUnits } from 'viem';
import { sophonTestnet } from '../../config/chains';
import usdcAbi from '../../abi/mockUsdc.json';
import { corsHeaders } from '../cors';

const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f') as `0x${string}`; // MockUSDC
const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x86E1D788FFCd8232D85dD7eB02c508e7021EB474') as `0x${string}`; // NanoMusicStore Proxy

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
    const headers = corsHeaders();
    
    try {
        const body = await request.json();
        const address = body.address as `0x${string}`;
        
        if (!address) {
            return NextResponse.json(
                { error: 'Address is required' },
                { status: 400, headers }
            );
        }

        const publicClient = createPublicClient({
            chain: sophonTestnet,
            transport: http(RPC_URL),
        });

        // Check all balances and allowance
        const [sophBalance, usdcBalance, allowance] = await Promise.all([
            publicClient.getBalance({ address }),
            publicClient.readContract({
                address: USDC_ADDRESS,
                abi: usdcAbi,
                functionName: 'balanceOf',
                args: [address],
            }) as Promise<bigint>,
            publicClient.readContract({
                address: USDC_ADDRESS,
                abi: usdcAbi,
                functionName: 'allowance',
                args: [address, STORE_CONTRACT],
            }) as Promise<bigint>,
        ]);

        return NextResponse.json({
            address,
            balances: {
                soph: {
                    wei: sophBalance.toString(),
                    formatted: formatUnits(sophBalance, 18) + ' SOPH'
                },
                usdc: {
                    raw: usdcBalance.toString(),
                    formatted: formatUnits(usdcBalance, 6) + ' USDC'
                }
            },
            allowance: {
                raw: allowance.toString(),
                formatted: formatUnits(allowance, 6) + ' USDC',
                store: STORE_CONTRACT
            },
            contracts: {
                usdc: USDC_ADDRESS,
                store: STORE_CONTRACT
            }
        }, { headers });
    } catch (err: any) {
        console.error('Check wallet error:', err.message);
        return NextResponse.json(
            { error: err.message || 'Failed to check wallet' },
            { status: 500, headers }
        );
    }
}