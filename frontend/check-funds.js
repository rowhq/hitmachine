#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, "") || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, "") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkFunds() {
  console.log('\n📊 Analyzing fund movements...\n');

  // Get all clawback summaries
  const { data: clawbacks } = await supabase
    .from('wallet_events')
    .select('*')
    .eq('event_type', 'clawback_summary')
    .order('created_at', { ascending: false });

  console.log('🔄 CLAWBACK HISTORY:');
  let totalClawedBack = 0n;
  clawbacks?.forEach((cb, i) => {
    const amount = BigInt(cb.metadata.total_amount_reclaimed || 0);
    totalClawedBack += amount;
    console.log(`  ${i + 1}. ${new Date(cb.created_at).toLocaleString()}`);
    console.log(`     Wallets: ${cb.metadata.total_clawbacks}`);
    console.log(`     Amount: ${(Number(amount) / 1e6).toFixed(2)} USDC`);
    console.log(`     Total system: ${(Number(BigInt(cb.metadata.balance_before)) / 1e6).toFixed(2)} USDC`);
  });
  console.log(`\n  Total Clawed Back: ${(Number(totalClawedBack) / 1e6).toFixed(2)} USDC`);

  // Get wallet generation count
  const { count: walletCount } = await supabase
    .from('wallet_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'wallet_funded');

  console.log(`\n💰 WALLET GENERATION:`);
  console.log(`  Total wallets funded: ${walletCount}`);
  console.log(`  Expected USDC distributed: ${(walletCount * 31.96).toFixed(2)} USDC`);

  // Get purchase count
  const { count: purchaseCount } = await supabase
    .from('wallet_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'giftcard_purchase');

  console.log(`\n🛒 GIFT CARD PURCHASES:`);
  console.log(`  Total purchases: ${purchaseCount}`);
  console.log(`  Expected USDC to store: ${(purchaseCount * 31.96).toFixed(2)} USDC`);

  // Calculate where funds should be
  const distributed = walletCount * 31.96;
  const purchased = purchaseCount * 31.96;
  const clawedBack = Number(totalClawedBack) / 1e6;
  const shouldBeInIdleWallets = distributed - purchased - clawedBack;

  console.log(`\n🧮 FUND ACCOUNTING:`);
  console.log(`  Distributed to users: ${distributed.toFixed(2)} USDC`);
  console.log(`  Purchased (to Store): ${purchased.toFixed(2)} USDC`);
  console.log(`  Clawed back (to Band): ${clawedBack.toFixed(2)} USDC`);
  console.log(`  Should be in idle wallets: ${shouldBeInIdleWallets.toFixed(2)} USDC`);
  console.log(`\n  Current system total: 3157.08 USDC`);
  console.log(`  Expected system total: ${(shouldBeInIdleWallets + purchased + clawedBack).toFixed(2)} USDC`);

  // Check for recent wallets still in KV
  console.log(`\n📝 Checking recent wallets in KV...`);
}

checkFunds().catch(console.error);
