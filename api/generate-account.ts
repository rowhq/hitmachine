import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mnemonicToAccount } from 'viem/accounts';
import {
    createWalletClient,
    createPublicClient,
    http,
    parseUnits,
    parseEther
} from 'viem';
import { erc20Abi } from 'viem';
import { sophon } from 'viem/chains';
import { kv } from '@vercel/kv';

const MNEMONIC = process.env.MNEMONIC!;
const USDC_ADDRESS = '0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F';
const RPC_URL = process.env.RPC_URL!;
const COINGECKO_URL =
    'https://api.coingecko.com/api/v3/simple/price?ids=sophon&vs_currencies=usd';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {

        const index = await kv.get('wallet_index');

        // Derive accounts
        const funder = mnemonicToAccount(MNEMONIC, { path: `m/44'/60'/0'/0/0` });
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

        // Prepare transfers
        const usdcTx = client.writeContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [recipient.address, parseUnits('0.01', 6)],
            nonce: confirmedNonce
        });

        const nativeTx = client.sendTransaction({
            to: recipient.address,
            value: parseEther(amountSOPH),
            nonce: confirmedNonce + 1
        });

        const [usdcHash, nativeHash] = await Promise.all([usdcTx, nativeTx]);

        // ✅ Store address => index mapping in KV
        await kv.set(`wallet_address_to_index:${recipient.address.toLowerCase()}`, index);

        return res.status(200).json({
            message: 'Account created; funded with 0.01 USDC and ~$0.02 SOPH',
            address: recipient.address,
            index,
            txHashes: { usdc: usdcHash, soph: nativeHash },
            sophSent: amountSOPH,
            priceUsd: sophPriceUsd
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'Unexpected error' });
    }
}
