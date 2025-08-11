import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount } from 'viem/accounts';
import {
    createWalletClient,
    createPublicClient,
    http,
} from 'viem';
import { sophon } from 'viem/chains';
import { kv } from '@vercel/kv';
import storeAbi from '../../abi/storeV2.json';

const MNEMONIC = process.env.MNEMONIC!;
const RPC_URL = process.env.RPC_URL || 'https://rpc.sophon.xyz';
const STORE_CONTRACT = process.env.NEXT_PUBLIC_STORE_CONTRACT || "0x13fBEfAd9EdC68E49806f6FC34f4CA161197b9B5";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const address = searchParams.get('address') as `0x${string}`;
        
        if (!address) {
            return NextResponse.json(
                { error: 'Address parameter is required' },
                { status: 400 }
            );
        }
        
        const index = await kv.get(`wallet_address_to_index:${address.toLowerCase()}`) as number;

        // Validate index range
        if (isNaN(index) || index < 0) {
            return NextResponse.json(
                { error: 'Index must be a non-negative integer' },
                { status: 400 }
            );
        }

        const maxIndex = await kv.get('wallet_index');
        if (index > Number(maxIndex)) {
            return NextResponse.json(
                { error: `Index out of bounds: max is ${maxIndex}` },
                { status: 400 }
            );
        }

        const account = mnemonicToAccount(MNEMONIC, {
            path: `m/44'/60'/0'/0/${index}`,
        });

        const publicClient = createPublicClient({
            chain: sophon,
            transport: http(RPC_URL),
        });

        // Check if album already purchased
        const hasPurchased = await publicClient.readContract({
            address: STORE_CONTRACT as `0x${string}`,
            abi: storeAbi,
            functionName: 'hasPurchased',
            args: [account.address],
        });

        if (hasPurchased) {
            return NextResponse.json(
                { error: 'Album already purchased' },
                { status: 400 }
            );
        }

        const walletClient = createWalletClient({
            account,
            chain: sophon,
            transport: http(RPC_URL),
        });

        // Simulate the transaction before submitting
        try {
            const { request } = await publicClient.simulateContract({
                address: STORE_CONTRACT as `0x${string}`,
                abi: storeAbi,
                functionName: 'buyAlbum',
                args: [],
                account: account.address,
            });

            // If simulation passes, execute the transaction
            const purchaseTx = await walletClient.writeContract(request);

            return NextResponse.json({
                message: 'Album purchased successfully',
                address: account.address,
                index,
                txHashes: {
                    purchase: purchaseTx,
                },
            });
        } catch (simulationError: any) {
            console.error('Transaction simulation failed:', simulationError);
            
            // Return more detailed error for simulation failures
            return NextResponse.json(
                { 
                    error: 'Transaction would fail',
                    details: simulationError.message || 'Simulation failed',
                    reason: simulationError.cause?.reason || simulationError.cause?.message
                },
                { status: 400 }
            );
        }
    } catch (err: any) {
        console.error(err);
        return NextResponse.json(
            { error: err.message || 'Unexpected error' },
            { status: 500 }
        );
    }
}