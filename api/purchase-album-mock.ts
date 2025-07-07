import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mnemonicToAccount } from 'viem/accounts';
import { kv } from '@vercel/kv';

const MNEMONIC = process.env.MNEMONIC!;

function generateFakeTxHash() {
    const randomHex = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return `0x${randomHex}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed. Use GET.' });
        }

        const indexParam = req.query.index;
        const index = parseInt(indexParam as string, 10);

        // Validate index range
        if (isNaN(index) || index <= 0) {
            return res.status(400).json({ error: 'Account index must be an integer > 0' });
        }

        const maxIndex = await kv.get('wallet_index');
        if (index > Number(maxIndex)) {
            return res.status(400).json({ error: `Account index out of bounds: max is ${maxIndex}` });
        }

        const account = mnemonicToAccount(MNEMONIC, {
            path: `m/44'/60'/0'/0/${index}`,
        });

        // 🧪 Simulate success with fake hashes
        const fakeApproveTx = generateFakeTxHash();
        const fakePurchaseTx = generateFakeTxHash();

        return res.status(200).json({
            message: '[MOCK] Album purchase successful',
            address: account.address,
            index,
            txHashes: {
                approve: fakeApproveTx,
                purchase: fakePurchaseTx,
            },
        });
    } catch (err: any) {
        console.error(err);
        return res.status(500).json({ error: err.message || 'Unexpected error' });
    }
}
