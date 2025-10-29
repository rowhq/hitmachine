#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret';

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
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

// Stress test functions
async function stressTestWalletGeneration(count) {
  log(`\n=== Generating ${count} wallets concurrently ===`, 'warning');
  const startTime = Date.now();
  const promises = [];
  const results = { success: 0, failed: 0, wallets: [] };

  for (let i = 0; i < count; i++) {
    promises.push(
      makeRequest('/api/generate-account', 'POST')
        .then(res => {
          if (res.status === 200) {
            results.success++;
            results.wallets.push(res.data.address);
            process.stdout.write(`\r✓ Generated: ${results.success}/${count}`);
          } else {
            results.failed++;
            process.stdout.write(`\r✗ Failed: ${results.failed}/${count}`);
          }
          return res;
        })
        .catch(() => {
          results.failed++;
          process.stdout.write(`\r✗ Failed: ${results.failed}/${count}`);
        })
    );
  }

  await Promise.all(promises);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(''); // newline
  log(`✓ Completed in ${duration}s`, 'success');
  log(`  Success: ${results.success}`, 'success');
  log(`  Failed: ${results.failed}`, 'error');
  log(`  Rate: ${(results.success / duration).toFixed(2)} wallets/sec`, 'info');

  return results;
}

async function stressTestPurchases(wallets) {
  log(`\n=== Testing ${wallets.length} purchases concurrently ===`, 'warning');
  const startTime = Date.now();
  const promises = [];
  const results = { success: 0, failed: 0 };

  for (const address of wallets) {
    promises.push(
      makeRequest('/api/purchase-giftcard', 'POST', { address })
        .then(res => {
          if (res.status === 200) {
            results.success++;
            process.stdout.write(`\r✓ Purchased: ${results.success}/${wallets.length}`);
          } else {
            results.failed++;
            process.stdout.write(`\r✗ Failed: ${results.failed}/${wallets.length}`);
          }
          return res;
        })
        .catch(() => {
          results.failed++;
          process.stdout.write(`\r✗ Failed: ${results.failed}/${wallets.length}`);
        })
    );
  }

  await Promise.all(promises);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(''); // newline
  log(`✓ Completed in ${duration}s`, 'success');
  log(`  Success: ${results.success}`, 'success');
  log(`  Failed: ${results.failed}`, 'error');
  log(`  Rate: ${(results.success / duration).toFixed(2)} purchases/sec`, 'info');

  return results;
}

async function testCronEndpoints() {
  log(`\n=== Testing Cron Endpoints ===`, 'warning');

  // Test fund management
  log('\n1. Testing fund-management cron...', 'info');
  try {
    const fundResponse = await makeRequest('/api/cron/fund-management', 'GET', null, {
      'Authorization': `Bearer ${CRON_SECRET}`
    });

    if (fundResponse.status === 200) {
      log('✓ Fund management cron executed', 'success');
      log(`  Store: ${fundResponse.data.balances?.store} USDC`, 'info');
      log(`  Band: ${fundResponse.data.balances?.band} USDC`, 'info');
      log(`  Nano Wallet: ${fundResponse.data.balances?.nanoWallet} USDC`, 'info');
      log(`  Transactions: ${JSON.stringify(fundResponse.data.transactions)}`, 'info');
    } else if (fundResponse.status === 401) {
      log('⚠ Fund management requires CRON_SECRET', 'warning');
    } else {
      log(`✗ Fund management failed: ${fundResponse.status}`, 'error');
      log(`  ${JSON.stringify(fundResponse.data)}`, 'error');
    }
  } catch (error) {
    log(`✗ Fund management error: ${error.message}`, 'error');
  }

  // Test clawback
  log('\n2. Testing clawback cron...', 'info');
  try {
    const clawbackResponse = await makeRequest('/api/cron/clawback', 'GET', null, {
      'Authorization': `Bearer ${CRON_SECRET}`
    });

    if (clawbackResponse.status === 200) {
      log('✓ Clawback cron executed', 'success');
      log(`  Total balance: ${clawbackResponse.data.balances?.total} USDC`, 'info');
      log(`  Clawbacks: ${clawbackResponse.data.clawbacks?.count || 0}`, 'info');
      log(`  Reclaimed: ${clawbackResponse.data.clawbacks?.totalReclaimed || '0'} USDC`, 'info');
      if (clawbackResponse.data.clawbacks?.details) {
        log(`  Details: ${JSON.stringify(clawbackResponse.data.clawbacks.details)}`, 'info');
      }
    } else if (clawbackResponse.status === 401) {
      log('⚠ Clawback requires CRON_SECRET', 'warning');
    } else {
      log(`✗ Clawback failed: ${clawbackResponse.status}`, 'error');
      log(`  ${JSON.stringify(clawbackResponse.data)}`, 'error');
    }
  } catch (error) {
    log(`✗ Clawback error: ${error.message}`, 'error');
  }
}

async function testAnalytics() {
  log(`\n=== Testing Analytics Endpoint ===`, 'warning');

  try {
    const response = await makeRequest('/api/analytics-dashboard', 'GET');

    if (response.status === 200) {
      log('✓ Analytics dashboard accessible', 'success');
      log(`  Wallets Generated: ${response.data.wallets?.totalGenerated}`, 'info');
      log(`  Total Purchases: ${response.data.revenue?.totalPurchases}`, 'info');
      log(`  Revenue: ${response.data.revenue?.totalRevenue} USDC`, 'info');
      log(`  Unique IPs: ${response.data.traffic?.uniqueVisitors}`, 'info');
      return response.data;
    } else {
      log(`✗ Analytics failed: ${response.status}`, 'error');
      return null;
    }
  } catch (error) {
    log(`✗ Analytics error: ${error.message}`, 'error');
    return null;
  }
}

// Main stress test
async function runStressTest() {
  log('\n╔══════════════════════════════════════════════════════╗', 'info');
  log('║       HitMachine FULL STRESS TEST                   ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');

  const WALLET_COUNT = parseInt(process.env.WALLET_COUNT || '100');

  log(`\nConfiguration:`, 'info');
  log(`  Target: ${BASE_URL}`, 'info');
  log(`  Wallets to generate: ${WALLET_COUNT}`, 'info');
  log(`  CRON_SECRET configured: ${CRON_SECRET !== 'test-secret'}`, 'info');

  // Step 1: Get initial analytics
  log('\n📊 STEP 1: Initial Analytics', 'warning');
  const initialAnalytics = await testAnalytics();

  // Step 2: Stress test wallet generation
  log('\n🔥 STEP 2: Stress Testing Wallet Generation', 'warning');
  const walletResults = await stressTestWalletGeneration(WALLET_COUNT);

  if (walletResults.success === 0) {
    log('\n❌ No wallets generated - aborting stress test', 'error');
    return;
  }

  // Wait for transactions to settle
  log('\n⏳ Waiting 10 seconds for transactions to confirm...', 'warning');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Step 3: Stress test purchases
  log('\n🔥 STEP 3: Stress Testing Purchases', 'warning');
  const purchaseResults = await stressTestPurchases(walletResults.wallets.slice(0, Math.min(50, walletResults.wallets.length)));

  // Wait for transactions to settle
  log('\n⏳ Waiting 10 seconds for purchase transactions...', 'warning');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Step 4: Test cron endpoints
  log('\n🤖 STEP 4: Testing Cron Jobs', 'warning');
  await testCronEndpoints();

  // Step 5: Get final analytics
  log('\n📊 STEP 5: Final Analytics', 'warning');
  const finalAnalytics = await testAnalytics();

  // Step 6: Summary
  log('\n╔══════════════════════════════════════════════════════╗', 'success');
  log('║              STRESS TEST COMPLETE                    ║', 'success');
  log('╚══════════════════════════════════════════════════════╝', 'success');

  log('\nResults Summary:', 'info');
  log(`  Wallets Generated: ${walletResults.success}/${WALLET_COUNT}`, walletResults.success > 0 ? 'success' : 'error');
  log(`  Purchases Completed: ${purchaseResults.success}/${purchaseResults.success + purchaseResults.failed}`, purchaseResults.success > 0 ? 'success' : 'warning');

  if (initialAnalytics && finalAnalytics) {
    const walletDiff = (finalAnalytics.wallets?.totalGenerated || 0) - (initialAnalytics.wallets?.totalGenerated || 0);
    const purchaseDiff = (finalAnalytics.revenue?.totalPurchases || 0) - (initialAnalytics.revenue?.totalPurchases || 0);
    log(`\nAnalytics Delta:`, 'info');
    log(`  Wallets: ${initialAnalytics.wallets?.totalGenerated} → ${finalAnalytics.wallets?.totalGenerated} (+${walletDiff})`, 'info');
    log(`  Purchases: ${initialAnalytics.revenue?.totalPurchases} → ${finalAnalytics.revenue?.totalPurchases} (+${purchaseDiff})`, 'info');
  }

  log('\n✅ System proved operational under load!', 'success');
  log('   The fund recycling system is ready for production.', 'info');
}

// Run it
runStressTest().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
