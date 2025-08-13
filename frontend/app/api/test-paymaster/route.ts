import { NextRequest, NextResponse } from 'next/server';
import { Provider, Wallet, utils } from 'zksync-ethers';
import { corsHeaders } from '../cors';

const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';
const PAYMASTER_ADDRESS = '0x98546B226dbbA8230cf620635a1e4ab01F6A99B2';

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
    const headers = corsHeaders();
    
    try {
        // Initialize zkSync provider and wallet
        const provider = new Provider(RPC_URL);
        const zkWallet = new Wallet(process.env.WALLET_PRIVATE_KEY!, provider);

        // Try the simplest transaction - just send 1 wei to self
        const tx = {
            to: zkWallet.address,
            value: BigInt(1), // 1 wei
            data: '0x',
            customData: {
                paymasterParams: {
                    paymaster: PAYMASTER_ADDRESS,
                    paymasterInput: '0x'
                }
            }
        };

        console.log('Testing paymaster with simple self-transfer...');
        console.log('Transaction:', {
            from: zkWallet.address,
            to: tx.to,
            value: tx.value.toString(),
            paymaster: PAYMASTER_ADDRESS
        });

        const txResponse = await zkWallet.sendTransaction(tx);
        const receipt = await txResponse.wait();
        
        console.log('Paymaster test successful!');

        return NextResponse.json({
            message: 'Paymaster test successful!',
            txHash: receipt.hash,
            from: zkWallet.address,
            to: tx.to,
            value: '1 wei',
            paymaster: PAYMASTER_ADDRESS,
            gasUsed: receipt.gasUsed?.toString(),
            status: receipt.status === 1 ? 'success' : 'failed'
        }, { headers });
    } catch (err: any) {
        console.error('Paymaster test error:', err);
        
        // Check if it's a specific paymaster error
        const errorMessage = err.message || 'Unknown error';
        let analysis = '';
        
        if (errorMessage.includes('not useable')) {
            analysis = 'The paymaster exists but is not configured to sponsor transactions from this address or contract.';
        } else if (errorMessage.includes('validation')) {
            analysis = 'The paymaster validation logic is rejecting the transaction.';
        } else if (errorMessage.includes('balance')) {
            analysis = 'The paymaster might not have enough balance.';
        }
        
        return NextResponse.json(
            { 
                error: errorMessage,
                analysis,
                suggestion: 'This paymaster likely requires whitelisting or specific configuration. You may need to deploy your own paymaster or contact Sophon team.'
            },
            { status: 500, headers }
        );
    }
}