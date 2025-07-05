import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mnemonicToAccount } from 'viem/accounts';
import {
    createWalletClient,
    createPublicClient,
    http,
} from 'viem';
import { sophon } from 'viem/chains';
import { kv } from '@vercel/kv';
import { parseUnits } from 'viem/utils';
import storeAbi from './abi/store.json';
import { erc20Abi } from 'viem';

const MNEMONIC = process.env.MNEMONIC!;
const RPC_URL = process.env.RPC_URL!;
const USDC_ADDRESS = '0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F';
const STORE_CONTRACT = "0x2619Aed377C6fC5BdC56d30A4347406dE9cd2A2c"; //TODO: Replace with actual store contract address

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed. Use GET.' });
        }

        const indexParam = req.query.index;
        const index = parseInt(indexParam as string, 10);

        // Validate index range
        if (isNaN(index) || index <= 0) {
            return res.status(400).json({ error: 'Index must be an integer > 0' });
        }

        const maxIndex = await kv.get('wallet_index');
        if (index > Number(maxIndex)) {
            return res.status(400).json({ error: `Index out of bounds: max is ${maxIndex}` });
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
            address: STORE_CONTRACT,
            abi: storeAbi,
            functionName: 'hasPurchased',
            args: [account.address],
        });

        if (hasPurchased) {
            return res.status(400).json({ error: 'Album already purchased' });
        }

        const walletClient = createWalletClient({
            account,
            chain: sophon,
            transport: http(RPC_URL),
        });

        // 1. Approve USDC spend
        const approveTx = await walletClient.writeContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [STORE_CONTRACT, parseUnits('8', 6)],
        });

        // 2. Call buyAlbum()
        const purchaseTx = await walletClient.writeContract({
            address: STORE_CONTRACT,
            abi: storeAbi,
            functionName: 'buyAlbum',
            args: [],
        });

        return res.status(200).json({
            message: 'Album purchased successfully',
            address: account.address,
            index,
            txHashes: {
                approve: approveTx,
                purchase: purchaseTx,
            },
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'Unexpected error' });
    }
}
