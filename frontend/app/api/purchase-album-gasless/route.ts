import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount } from 'viem/accounts';
import { parseUnits } from 'viem';
import { Provider, Wallet, utils, Contract } from 'zksync-ethers';
import { ethers } from 'ethers';
import { kv } from '@vercel/kv';
import storeAbi from '../../abi/storeV2.json';
import usdcAbi from '../../abi/mockUsdc.json';
import { corsHeaders } from '../cors';

const MNEMONIC = process.env.MNEMONIC!;
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';
const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0xE6F17c2093620F2AE2bB51F1fa05bFe1cf8E7fEA') as `0x${string}`;
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0xCF0B96c99785805014c6e1a66399F567367799c2') as `0x${string}`;
const PAYMASTER_ADDRESS = '0x98546B226dbbA8230cf620635a1e4ab01F6A99B2';

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

        // Validate index
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

        // Derive the wallet from mnemonic
        const account = mnemonicToAccount(MNEMONIC, {
            path: `m/44'/60'/0'/0/${index}`,
        });

        console.log(`Derived wallet for index ${index}: ${account.address}`);
        
        // Verify the derived wallet matches
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

        // Initialize zkSync provider and wallet
        const provider = new Provider(RPC_URL);
        const zkWallet = new Wallet(account.privateKey, provider);

        // Check if album already purchased
        const storeContract = new Contract(STORE_CONTRACT, storeAbi, provider);
        const hasPurchased = await storeContract.hasPurchased(account.address);
        
        if (hasPurchased) {
            return NextResponse.json(
                { error: 'Album already purchased' },
                { status: 400, headers }
            );
        }

        // Get album price
        const albumPrice = await storeContract.albumPrice();
        console.log(`Album price: ${albumPrice.toString()}`);

        // Check and handle USDC approval with paymaster
        const usdcContract = new Contract(USDC_ADDRESS, usdcAbi, provider);
        const currentAllowance = await usdcContract.allowance(account.address, STORE_CONTRACT);
        
        console.log(`Current allowance: ${currentAllowance.toString()}, Album price: ${albumPrice.toString()}`);

        if (currentAllowance < albumPrice) {
            console.log('Approving USDC with paymaster...');
            
            // Approve USDC with paymaster
            const approvalAmount = parseUnits('0.02', 6); // Approve 0.02 USDC
            const approvalInterface = new ethers.Interface(usdcAbi);
            const approvalCalldata = approvalInterface.encodeFunctionData('approve', [
                STORE_CONTRACT,
                approvalAmount
            ]);

            const approvalTx = {
                to: USDC_ADDRESS,
                data: approvalCalldata,
                value: 0n,
                customData: {
                    paymasterParams: {
                        paymaster: PAYMASTER_ADDRESS,
                        paymasterInput: utils.getPaymasterParams(PAYMASTER_ADDRESS, {
                            type: 'General',
                            innerInput: new Uint8Array()
                        }).paymasterInput
                    }
                }
            };

            const approvalResponse = await zkWallet.sendTransaction(approvalTx);
            const approvalReceipt = await approvalResponse.wait();
            console.log(`Approval successful (gasless): ${approvalReceipt.hash}`);
        }

        // Purchase album with paymaster
        console.log('Purchasing album with paymaster...');
        const purchaseInterface = new ethers.Interface(storeAbi);
        const purchaseCalldata = purchaseInterface.encodeFunctionData('buyAlbum', []);

        const purchaseTx = {
            to: STORE_CONTRACT,
            data: purchaseCalldata,
            value: 0n,
            customData: {
                paymasterParams: {
                    paymaster: PAYMASTER_ADDRESS,
                    paymasterInput: utils.getPaymasterParams(PAYMASTER_ADDRESS, {
                        type: 'General',
                        innerInput: new Uint8Array()
                    }).paymasterInput
                }
            }
        };

        const purchaseResponse = await zkWallet.sendTransaction(purchaseTx);
        const purchaseReceipt = await purchaseResponse.wait();

        return NextResponse.json({
            message: 'Album purchased successfully (GASLESS with Paymaster)',
            buyer: account.address,
            index,
            txHash: purchaseReceipt.hash,
            blockNumber: purchaseReceipt.blockNumber.toString(),
            status: purchaseReceipt.status === 1 ? 'success' : 'failed',
            approvalNeeded: currentAllowance < albumPrice,
            paymaster: PAYMASTER_ADDRESS,
            gasless: true
        }, { headers });
    } catch (err: any) {
        console.error('Purchase album gasless error:', err.message || err);
        return NextResponse.json(
            { error: err.message || 'Unexpected error' },
            { status: 500, headers }
        );
    }
}