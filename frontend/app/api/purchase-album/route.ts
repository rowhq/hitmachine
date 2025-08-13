import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount } from 'viem/accounts';
import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits
} from 'viem';
import { sophonTestnet } from '../../config/chains';
import { kv } from '@vercel/kv';
import storeAbi from '../../abi/storeV2.json';
import usdcAbi from '../../abi/mockUsdc.json';
import { corsHeaders } from '../cors';

const MNEMONIC = process.env.MNEMONIC!;
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';
const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x9af4b8A05B001A7dCbfD428C444f73Ff7d10d520') as `0x${string}`;
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x10Af06Bb43F5ed51A289d22641135c6fC97987Ad') as `0x${string}`;

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
    const headers = corsHeaders();
    
    try {
        let body;
        try {
            body = await request.json();
        } catch (parseError: any) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parseError.message },
                { status: 400, headers }
            );
        }
        const address = body.address as `0x${string}`;
        
        if (!address) {
            return NextResponse.json(
                { error: 'Address parameter is required' },
                { status: 400, headers }
            );
        }
        
        const index = await kv.get(`wallet_address_to_index:${address.toLowerCase()}`) as number;

        console.log(`Looking up wallet ${address.toLowerCase()}, found index: ${index}`);

        // Validate index range
        if (index === null || index === undefined || isNaN(index) || index < 0) {
            return NextResponse.json(
                { 
                    error: 'Wallet not found in system',
                    details: 'This wallet was not generated through the system. Please use Generate Wallet first.',
                    address: address,
                    indexFound: index
                },
                { status: 400, headers }
            );
        }

        const maxIndex = await kv.get('wallet_index');
        if (index > Number(maxIndex)) {
            return NextResponse.json(
                { error: `Index out of bounds: max is ${maxIndex}` },
                { status: 400, headers }
            );
        }

        const account = mnemonicToAccount(MNEMONIC, {
            path: `m/44'/60'/0'/0/${index}`,
        });

        console.log(`Derived wallet for index ${index}: ${account.address}`);
        
        // Verify the derived wallet matches the input address
        if (account.address.toLowerCase() !== address.toLowerCase()) {
            return NextResponse.json(
                { 
                    error: 'Wallet mismatch',
                    details: 'The derived wallet does not match the provided address',
                    providedAddress: address,
                    derivedAddress: account.address,
                    index: index
                },
                { status: 400, headers }
            );
        }

        const publicClient = createPublicClient({
            chain: sophonTestnet,
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
                { status: 400, headers }
            );
        }

        const walletClient = createWalletClient({
            account,
            chain: sophonTestnet,
            transport: http(RPC_URL),
        });

        // Check wallet's SOPH balance for gas
        const sophBalance = await publicClient.getBalance({
            address: account.address,
        });

        console.log(`Wallet ${account.address} SOPH balance: ${sophBalance.toString()} wei`);

        // Allow purchase if wallet has at least some SOPH for gas (even a small amount)
        // 0.001 SOPH should be enough for a few transactions
        const minGasBalance = parseUnits('0.001', 18);
        
        if (sophBalance < minGasBalance) {
            return NextResponse.json(
                { 
                    error: 'Insufficient SOPH for gas fees',
                    wallet: account.address,
                    sophBalance: (Number(sophBalance) / 1e18).toFixed(6),
                    minRequired: '0.001 SOPH',
                    hint: 'Wallet needs at least 0.001 SOPH for transaction fees'
                },
                { status: 400, headers }
            );
        }

        // Get the album price from the store contract
        const albumPrice = await publicClient.readContract({
            address: STORE_CONTRACT,
            abi: storeAbi,
            functionName: 'albumPrice',
        }) as bigint;

        // Check current allowance
        const currentAllowance = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: usdcAbi,
            functionName: 'allowance',
            args: [account.address, STORE_CONTRACT],
        }) as bigint;

        console.log(`Current allowance: ${currentAllowance.toString()}, Album price: ${albumPrice.toString()}`);

        // If allowance is insufficient, approve the Store contract
        if (currentAllowance < albumPrice) {
            console.log(`Current allowance: ${currentAllowance.toString()}, needed: ${albumPrice.toString()}. Approving...`);
            
            try {
                console.log(`Attempting approval from ${account.address} to ${STORE_CONTRACT}`);
                console.log(`USDC address: ${USDC_ADDRESS}`);
                
                // First check the wallet has USDC balance
                const usdcBalance = await publicClient.readContract({
                    address: USDC_ADDRESS,
                    abi: usdcAbi,
                    functionName: 'balanceOf',
                    args: [account.address],
                }) as bigint;
                
                console.log(`Wallet USDC balance: ${usdcBalance.toString()}`);
                
                // Try approving just the amount needed
                const approvalAmount = parseUnits('0.02', 6); // Approve 0.02 USDC
                
                console.log(`Approving ${approvalAmount.toString()} units (album price: ${albumPrice.toString()})`);
                console.log(`Chain ID: ${sophonTestnet.id}`);
                console.log(`Wallet address: ${account.address}`);
                
                const approveTx = await walletClient.writeContract({
                    address: USDC_ADDRESS,
                    abi: usdcAbi,
                    functionName: 'approve',
                    args: [STORE_CONTRACT, approvalAmount],
                    chain: sophonTestnet,
                });
                
                console.log(`Approval tx sent: ${approveTx}`);

                // Wait for approval confirmation
                const approvalReceipt = await publicClient.waitForTransactionReceipt({
                    hash: approveTx,
                });

                if (approvalReceipt.status !== 'success') {
                    return NextResponse.json(
                        { error: 'USDC approval failed' },
                        { status: 500, headers }
                    );
                }
                console.log(`Approval successful: ${approveTx}`);
            } catch (approvalError: any) {
                console.error('Approval failed:', approvalError.message);
                console.error('Error details:', {
                    cause: approvalError.cause,
                    shortMessage: approvalError.shortMessage,
                    metaMessages: approvalError.metaMessages
                });
                
                // Extract the actual error message
                let errorMessage = 'Failed to approve USDC spending';
                let errorDetails = approvalError.message;
                
                if (approvalError.shortMessage) {
                    errorDetails = approvalError.shortMessage;
                }
                if (approvalError.cause?.reason) {
                    errorDetails = approvalError.cause.reason;
                }
                if (approvalError.metaMessages && approvalError.metaMessages.length > 0) {
                    errorDetails = approvalError.metaMessages.join(', ');
                }
                
                return NextResponse.json(
                    { 
                        error: errorMessage,
                        details: errorDetails,
                        wallet: account.address,
                        sophBalance: (Number(sophBalance) / 1e18).toFixed(6),
                        usdcBalance: (Number(usdcBalance) / 1e6).toFixed(6),
                        usdcAddress: USDC_ADDRESS,
                        storeContract: STORE_CONTRACT
                    },
                    { status: 500, headers }
                );
            }
        }

        // Now attempt the purchase
        try {
            // Skip simulation and directly execute since we have the private key
            const purchaseTx = await walletClient.writeContract({
                address: STORE_CONTRACT,
                abi: storeAbi,
                functionName: 'buyAlbum',
                args: [],
                chain: sophonTestnet,
            });
            
            // Wait for transaction receipt
            const receipt = await publicClient.waitForTransactionReceipt({
                hash: purchaseTx,
            });

            return NextResponse.json({
                message: 'Album purchased successfully',
                buyer: account.address,
                index,
                txHash: purchaseTx,
                blockNumber: receipt.blockNumber.toString(),
                status: receipt.status,
                approvalNeeded: currentAllowance < albumPrice
            }, { headers });
        } catch (simulationError: any) {
            console.error('Transaction simulation failed:', simulationError.message || 'Unknown error');
            
            // Return more detailed error for simulation failures
            return NextResponse.json(
                { 
                    error: 'Transaction would fail',
                    details: simulationError.message || 'Simulation failed',
                    reason: simulationError.cause?.reason || simulationError.cause?.message
                },
                { status: 400, headers }
            );
        }
    } catch (err: any) {
        console.error('Purchase album error:', err.message || err);
        return NextResponse.json(
            { error: err.message || 'Unexpected error' },
            { status: 500, headers }
        );
    }
}