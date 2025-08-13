import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { sophonTestnet } from '../../config/chains';
import { corsHeaders } from '../cors';

const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
    const headers = corsHeaders();
    
    try {
        const body = await request.json();
        const txHash = body.txHash as `0x${string}`;
        
        if (!txHash) {
            return NextResponse.json(
                { error: 'Transaction hash is required' },
                { status: 400, headers }
            );
        }

        const publicClient = createPublicClient({
            chain: sophonTestnet,
            transport: http(RPC_URL),
        });

        // Get transaction details
        const [tx, receipt] = await Promise.all([
            publicClient.getTransaction({ hash: txHash }),
            publicClient.getTransactionReceipt({ hash: txHash })
        ]);

        // Check if paymaster was used
        const isPaymasterUsed = tx.from !== receipt.from;
        
        return NextResponse.json({
            txHash,
            from: tx.from,
            to: tx.to,
            value: tx.value?.toString(),
            gas: tx.gas?.toString(),
            gasPrice: tx.gasPrice?.toString(),
            gasUsed: receipt.gasUsed?.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
            status: receipt.status,
            blockNumber: receipt.blockNumber?.toString(),
            // Calculate actual fee paid
            gasCost: receipt.gasUsed && receipt.effectiveGasPrice 
                ? (receipt.gasUsed * receipt.effectiveGasPrice).toString()
                : 'N/A',
            paidBy: tx.from,
            paymaster: isPaymasterUsed ? 'Potentially used' : 'Not used',
            note: 'If paymaster was used, gas would be paid by paymaster contract, not the from address'
        }, { headers });
    } catch (err: any) {
        console.error('Check tx error:', err.message);
        return NextResponse.json(
            { error: err.message || 'Failed to check transaction' },
            { status: 500, headers }
        );
    }
}