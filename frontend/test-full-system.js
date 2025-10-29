#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const CRON_SECRET = process.env.CRON_SECRET || 'your-cron-secret';

// Helper to make HTTP requests
function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test utilities
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m',
  };
  const prefix = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    warning: '⚠',
  };
  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function testContractBalances() {
  log('\n=== Testing Contract Balance Checks ===', 'info');

  try {
    const response = await makeRequest('/api/cron/fund-management', 'GET', null, {
      'Authorization': `Bearer ${CRON_SECRET}`
    });

    if (response.status === 200) {
      log('Fund management cron accessible', 'success');
      log(`  Store balance: ${response.data.balances?.store || 'N/A'} USDC`);
      log(`  Band balance: ${response.data.balances?.band || 'N/A'} USDC`);
      log(`  Nano wallet balance: ${response.data.balances?.nanoWallet || 'N/A'} USDC`);
      log(`  Transactions: ${JSON.stringify(response.data.transactions || [])}`);
      return response.data.balances;
    } else {
      log(`Fund management check failed: ${response.status} - ${JSON.stringify(response.data)}`, 'error');
      return null;
    }
  } catch (error) {
    log(`Error checking balances: ${error.message}`, 'error');
    return null;
  }
}

async function testGenerateWallet() {
  log('\n=== Testing Wallet Generation ===', 'info');

  try {
    const response = await makeRequest('/api/generate-account', 'POST');

    if (response.status === 200) {
      log('Wallet generated successfully', 'success');
      log(`  Address: ${response.data.address}`);
      log(`  Index: ${response.data.index}`);
      log(`  Pay TX: ${response.data.payTx}`);
      log(`  Approve TX: ${response.data.approveTx}`);
      return response.data;
    } else {
      log(`Wallet generation failed: ${response.status} - ${JSON.stringify(response.data)}`, 'error');
      return null;
    }
  } catch (error) {
    log(`Error generating wallet: ${error.message}`, 'error');
    return null;
  }
}

async function testPurchaseGiftcard(address) {
  log('\n=== Testing Gift Card Purchase ===', 'info');

  try {
    const response = await makeRequest('/api/purchase-giftcard', 'POST', { address });

    if (response.status === 200) {
      log('Gift card purchased successfully', 'success');
      log(`  TX Hash: ${response.data.txHash}`);
      log(`  Token ID: ${response.data.tokenId}`);
      return response.data;
    } else {
      log(`Purchase failed: ${response.status} - ${JSON.stringify(response.data)}`, 'error');
      return null;
    }
  } catch (error) {
    log(`Error purchasing: ${error.message}`, 'error');
    return null;
  }
}

async function testClawback() {
  log('\n=== Testing Clawback Cron ===', 'info');

  try {
    const response = await makeRequest('/api/cron/clawback', 'GET', null, {
      'Authorization': `Bearer ${CRON_SECRET}`
    });

    if (response.status === 200) {
      log('Clawback cron executed', 'success');
      log(`  Store balance: ${response.data.balances?.store || 'N/A'} USDC`);
      log(`  Band balance: ${response.data.balances?.band || 'N/A'} USDC`);
      log(`  Nano wallet balance: ${response.data.balances?.nanoWallet || 'N/A'} USDC`);
      log(`  Total balance: ${response.data.balances?.total || 'N/A'} USDC`);
      log(`  Clawbacks executed: ${response.data.clawbacks?.count || 0}`);
      log(`  Total reclaimed: ${response.data.clawbacks?.totalReclaimed || '0'} USDC`);
      return response.data;
    } else {
      log(`Clawback failed: ${response.status} - ${JSON.stringify(response.data)}`, 'error');
      return null;
    }
  } catch (error) {
    log(`Error executing clawback: ${error.message}`, 'error');
    return null;
  }
}

async function testAnalytics() {
  log('\n=== Testing Analytics Dashboard ===', 'info');

  try {
    const response = await makeRequest('/api/analytics-dashboard', 'GET');

    if (response.status === 200) {
      log('Analytics dashboard accessible', 'success');
      log(`  Total wallets: ${response.data.wallets?.totalGenerated || 0}`);
      log(`  Total purchases: ${response.data.revenue?.totalPurchases || 0}`);
      log(`  Unique IPs: ${response.data.traffic?.uniqueVisitors || 0}`);
      return response.data;
    } else {
      log(`Analytics failed: ${response.status}`, 'error');
      return null;
    }
  } catch (error) {
    log(`Error fetching analytics: ${error.message}`, 'error');
    return null;
  }
}

// Main test runner
async function runFullTest() {
  log('\n╔══════════════════════════════════════════════════════╗', 'info');
  log('║  HitMachine Full System Integration Test           ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');

  log(`\nTarget: ${BASE_URL}`);
  log(`Network: testnet (from .env.local)`);

  // Step 1: Check initial balances (skip if no CRON_SECRET)
  let initialBalances = null;
  if (CRON_SECRET && CRON_SECRET !== 'your-cron-secret') {
    initialBalances = await testContractBalances();
  } else {
    log('\n⚠ Skipping cron tests (CRON_SECRET not configured)', 'warning');
  }

  // Step 2: Check analytics before
  const initialAnalytics = await testAnalytics();

  // Step 3: Generate a wallet
  log('\n--- Testing Wallet Generation & Funding Flow ---', 'warning');
  const wallet = await testGenerateWallet();
  if (!wallet) {
    log('\n❌ Wallet generation failed - aborting test', 'error');
    return;
  }

  log('\nWaiting 5 seconds for transactions to confirm...', 'warning');
  await sleep(5000);

  // Step 4: Purchase gift card
  log('\n--- Testing Purchase Flow ---', 'warning');
  const purchase = await testPurchaseGiftcard(wallet.address);
  if (!purchase) {
    log('\n⚠ Purchase failed (this is okay for testing)', 'warning');
  }

  log('\nWaiting 5 seconds for purchase transaction...', 'warning');
  await sleep(5000);

  // Step 5: Check balances after operations
  let afterBalances = null;
  if (CRON_SECRET && CRON_SECRET !== 'your-cron-secret') {
    afterBalances = await testContractBalances();
    // Step 6: Test clawback (won't trigger unless balance is low)
    await testClawback();
  }

  // Step 7: Check analytics after
  const finalAnalytics = await testAnalytics();

  // Summary
  log('\n╔══════════════════════════════════════════════════════╗', 'info');
  log('║  Test Summary                                        ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');

  if (initialBalances && afterBalances) {
    log('\nBalance Changes:', 'info');
    log(`  Store: ${initialBalances.store} → ${afterBalances.store}`);
    log(`  Band: ${initialBalances.band} → ${afterBalances.band}`);
    log(`  Nano Wallet: ${initialBalances.nanoWallet} → ${afterBalances.nanoWallet}`);
  }

  if (initialAnalytics && finalAnalytics) {
    log('\nAnalytics Changes:', 'info');
    const walletDiff = (finalAnalytics.wallets?.totalGenerated || 0) - (initialAnalytics.wallets?.totalGenerated || 0);
    const purchaseDiff = (finalAnalytics.revenue?.totalPurchases || 0) - (initialAnalytics.revenue?.totalPurchases || 0);
    log(`  Wallets Generated: +${walletDiff}`);
    log(`  Purchases Completed: +${purchaseDiff}`);
  }

  log('\n✅ Full system test completed!', 'success');
  log('\nNote: The cron jobs will handle fund management and clawback automatically', 'info');
  log('      based on the configured thresholds:', 'info');
  log('      - Store withdrawal: > 3,000 USDC', 'info');
  log('      - Band refill: < 10,000 USDC', 'info');
  log('      - Clawback trigger: Total < 15,000 USDC', 'info');
}

// Run the test
runFullTest().catch(error => {
  log(`\nFatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
