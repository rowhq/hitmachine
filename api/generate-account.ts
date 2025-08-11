import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { erc20Abi } from 'viem';
import { sophon } from 'viem/chains';
import { kv } from '@vercel/kv';
import { protectEndpoint } from './middleware/domainCheck';

const MNEMONIC = process.env.MNEMONIC!;
const USDC_ADDRESS = '0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F';
const STORE_CONTRACT = process.env.STORE_CONTRACT!;
const RPC_URL = process.env.RPC_URL!;

async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const index = await kv.get('wallet_index') || 0;
    
    const funder = privateKeyToAccount(`0x${process.env.WALLET_PRIVATE_KEY!}`);
    const recipient = mnemonicToAccount(MNEMONIC, {
      path: `m/44'/60'/0'/0/${index}`
    });
    
    // Check if already exists
    const existing = await kv.get(`wallet:${recipient.address.toLowerCase()}`);
    if (existing) {
      return res.status(200).json({
        address: recipient.address,
        cached: true
      });
    }
    
    await kv.incr("wallet_index");
    
    const client = createWalletClient({
      account: funder,
      chain: sophon,
      transport: http(RPC_URL)
    });
    
    const publicClient = createPublicClient({
      chain: sophon,
      transport: http(RPC_URL)
    });
    
    // Send USDC
    const usdcTx = await client.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient.address, parseUnits('0.01', 6)]
    });
    
    // Send gas
    const gasTx = await client.sendTransaction({
      to: recipient.address,
      value: parseUnits('0.0001', 18) // Small amount for gas
    });
    
    await Promise.all([
      publicClient.waitForTransactionReceipt({ hash: usdcTx }),
      publicClient.waitForTransactionReceipt({ hash: gasTx })
    ]);
    
    // Store wallet
    await kv.set(`wallet:${recipient.address.toLowerCase()}`, {
      index,
      created: Date.now()
    });
    
    return res.status(200).json({
      success: true,
      address: recipient.address
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to create wallet' });
  }
}

// Wrap with protection middleware
export default function(req: VercelRequest, res: VercelResponse) {
  return protectEndpoint(req, res, () => handler(req, res));
}