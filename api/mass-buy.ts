import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mnemonicToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { erc20Abi } from 'viem';
import { sophon } from 'viem/chains';
import { kv } from '@vercel/kv';
import storeAbi from './abi/storeV2.json';

const MNEMONIC = process.env.MNEMONIC!;
const USDC_ADDRESS = '0x9Aa0F72392B5784Ad86c6f3E899bCc053D00Db4F';
const STORE_CONTRACT = process.env.STORE_CONTRACT!;
const RPC_URL = process.env.RPC_URL!;
const ADMIN_WALLET = process.env.WALLET_PRIVATE_KEY!; // The NANO wallet
const MASS_BUY_API_KEY = process.env.MASS_BUY_API_KEY!; // Generate and add this

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check API key
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (apiKey !== MASS_BUY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { startIndex, endIndex } = req.body || req.query;
    
    if (!startIndex || !endIndex) {
      return res.status(400).json({ 
        error: 'Missing parameters',
        message: 'Provide startIndex and endIndex' 
      });
    }
    
    const start = parseInt(startIndex as string);
    const end = parseInt(endIndex as string);
    
    if (end - start > 50) {
      return res.status(400).json({ 
        error: 'Too many wallets',
        message: 'Maximum 50 wallets per request' 
      });
    }
    
    const publicClient = createPublicClient({
      chain: sophon,
      transport: http(RPC_URL)
    });
    
    const results = [];
    const errors = [];
    
    // Process each wallet
    for (let index = start; index <= end; index++) {
      try {
        // Derive wallet
        const account = mnemonicToAccount(MNEMONIC, {
          path: `m/44'/60'/0'/0/${index}`
        });
        
        const client = createWalletClient({
          account,
          chain: sophon,
          transport: http(RPC_URL)
        });
        
        // Check if already purchased
        const hasPurchased = await publicClient.readContract({
          address: STORE_CONTRACT,
          abi: storeAbi,
          functionName: 'hasPurchased',
          args: [account.address]
        });
        
        if (hasPurchased) {
          results.push({
            index,
            address: account.address,
            status: 'already_purchased',
            txHash: null
          });
          continue;
        }
        
        // Check USDC balance
        const usdcBalance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account.address]
        }) as bigint;
        
        if (usdcBalance < parseUnits('0.01', 6)) {
          results.push({
            index,
            address: account.address,
            status: 'insufficient_balance',
            balance: usdcBalance.toString()
          });
          continue;
        }
        
        // Check allowance
        const allowance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account.address, STORE_CONTRACT]
        }) as bigint;
        
        // Approve if needed
        if (allowance < parseUnits('0.01', 6)) {
          const approveTx = await client.writeContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'approve',
            args: [STORE_CONTRACT, parseUnits('0.01', 6)]
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        
        // Execute purchase
        const buyTx = await client.writeContract({
          address: STORE_CONTRACT,
          abi: storeAbi,
          functionName: 'buyAlbum',
          args: []
        });
        
        await publicClient.waitForTransactionReceipt({ hash: buyTx });
        
        results.push({
          index,
          address: account.address,
          status: 'success',
          txHash: buyTx
        });
        
      } catch (error: any) {
        errors.push({
          index,
          error: error.message
        });
      }
    }
    
    // Now send any remaining USDC back to NANO wallet
    const refunds = [];
    for (let index = start; index <= end; index++) {
      try {
        const account = mnemonicToAccount(MNEMONIC, {
          path: `m/44'/60'/0'/0/${index}`
        });
        
        const client = createWalletClient({
          account,
          chain: sophon,
          transport: http(RPC_URL)
        });
        
        // Get remaining USDC balance
        const remainingUsdc = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account.address]
        }) as bigint;
        
        if (remainingUsdc > 0) {
          // Send back to NANO wallet
          const nanoWallet = (await import('viem/accounts')).privateKeyToAccount(`0x${ADMIN_WALLET}`);
          
          const refundTx = await client.writeContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [nanoWallet.address, remainingUsdc]
          });
          
          await publicClient.waitForTransactionReceipt({ hash: refundTx });
          
          refunds.push({
            index,
            address: account.address,
            amount: remainingUsdc.toString(),
            txHash: refundTx
          });
        }
        
      } catch (error: any) {
        console.error(`Refund error for wallet ${index}:`, error);
      }
    }
    
    return res.status(200).json({
      success: true,
      summary: {
        processed: results.length,
        successful: results.filter(r => r.status === 'success').length,
        alreadyPurchased: results.filter(r => r.status === 'already_purchased').length,
        errors: errors.length,
        refunded: refunds.length
      },
      results,
      refunds,
      errors
    });
    
  } catch (error: any) {
    console.error('Mass buy error:', error);
    return res.status(500).json({ 
      error: 'Mass buy failed',
      details: error.message 
    });
  }
}