import { NextRequest, NextResponse } from 'next/server';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits
} from 'viem';
import { erc20Abi } from 'viem';
import { sophon } from 'viem/chains';
import { kv } from '@vercel/kv';
import storeAbi from '../../abi/storeV2.json';

const MNEMONIC = process.env.MNEMONIC!;
const USDC_ADDRESS = '0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F';
const STORE_CONTRACT = process.env.NEXT_PUBLIC_STORE_CONTRACT || "0x13fBEfAd9EdC68E49806f6FC34f4CA161197b9B5";
const RPC_URL = process.env.RPC_URL || 'https://rpc.sophon.xyz';
const COINGECKO_URL =
    'https://api.coingecko.com/api/v3/simple/price?ids=sophon&vs_currencies=usd';

export async function POST(request: NextRequest) {
    try {
        const index = await kv.get('wallet_index') || 0;

        // Derive accounts
        const funder = privateKeyToAccount(`0x${process.env.WALLET_PRIVATE_KEY!}`);
        const recipient = mnemonicToAccount(MNEMONIC, {
            path: `m/44'/60'/0'/0/${index}`
        });

        // increment wallet index
        await kv.incr("wallet_index");

        const client = createWalletClient({
            account: funder,
            chain: sophon,
            transport: http(RPC_URL)
        });

        // Fetch SOPH price
        const priceRes = await fetch(COINGECKO_URL);
        if (!priceRes.ok) throw new Error('Failed to fetch price');
        const priceData = await priceRes.json();
        const sophPriceUsd = priceData.sophon.usd as number;

        const amountUsd = 0.02;
        const amountSOPH = (amountUsd / sophPriceUsd).toFixed(18);

        const publicClient = createPublicClient({
            chain: sophon,
            transport: http(RPC_URL)
        });

        const confirmedNonce = await publicClient.getTransactionCount({
            address: funder.address,
            blockTag: 'latest'
        });

        // Simulate USDC transfer before executing
        const { request: usdcRequest } = await publicClient.simulateContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [recipient.address, parseUnits('0.01', 6)],
            account: funder.address,
        });

        // Execute USDC transfer
        const usdcTxHash = await client.writeContract({
            ...usdcRequest,
            nonce: confirmedNonce
        });

        const clientGenerated = createWalletClient({
            account: recipient,
            chain: sophon,
            transport: http(RPC_URL)
        });

        // Estimate gas for approve()
        const approveGasEstimate = await publicClient.estimateContractGas({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [STORE_CONTRACT as `0x${string}`, parseUnits('0.01', 6)],
            account: funder.address,
        });

        // Query current gas price
        const approveGasPrice = await publicClient.getGasPrice();

        // Calculate required SOPH to cover approve gas
        const approveGasFee = approveGasEstimate * approveGasPrice;
        const bufferMultiplier = BigInt(13); // +30% safety buffer
        const approveGasFeeBuffered = (approveGasFee * bufferMultiplier) / BigInt(10);

        // Send SOPH to recipient to cover approve gas
        const approveFundingTxHash = await client.sendTransaction({
            to: recipient.address,
            value: approveGasFeeBuffered,
            nonce: confirmedNonce + 1
        });

        await publicClient.waitForTransactionReceipt({ hash: approveFundingTxHash });

        // Simulate and execute approve
        const { request: approveRequest } = await publicClient.simulateContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [STORE_CONTRACT as `0x${string}`, parseUnits('0.01', 6)],
            account: recipient.address,
        });

        const approveTxHash = await clientGenerated.writeContract(approveRequest);

        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

        // Estimate gas for buyAlbum()
        const gasEstimate = await publicClient.estimateContractGas({
            address: STORE_CONTRACT as `0x${string}`,
            abi: storeAbi,
            functionName: 'buyAlbum',
            args: [],
            account: recipient.address,
        });

        // Query current gas price
        const gasPrice = await publicClient.getGasPrice();

        // Calculate required SOPH to cover gas
        const gasFee = gasEstimate * gasPrice;

        const nativeTxHash = await client.sendTransaction({
            to: recipient.address,
            value: gasFee,
            nonce: confirmedNonce + 2
        });

        await publicClient.waitForTransactionReceipt({ hash: nativeTxHash });

        // Store address => index mapping in KV
        await kv.set(`wallet_address_to_index:${recipient.address.toLowerCase()}`, index);

        return NextResponse.json({
            message: 'Account created; funded with 0.01 USDC and ~$0.02 SOPH',
            address: recipient.address,
            index,
            txHashes: { usdc: usdcTxHash, soph: nativeTxHash, approveTxHash: approveTxHash },
            sophSent: amountSOPH,
            priceUsd: sophPriceUsd
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json(
            { error: err.message || 'Unexpected error' },
            { status: 500 }
        );
    }
}