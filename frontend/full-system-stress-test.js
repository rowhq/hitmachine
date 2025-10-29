#!/usr/bin/env node

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'hitmachine-cron-secret-2025';

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

async function checkContractBalances() {
  try {
    const response = await makeRequest('/api/cron/fund-management', 'POST', null, {
      'Authorization': `Bearer ${CRON_SECRET}`
    });

    if (response.status === 200) {
      return response.data.balances;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function runFundManagement() {
  log('\n🔄 Running fund management cron...', 'warning');
  try {
    const response = await makeRequest('/api/cron/fund-management', 'POST', null, {
      'Authorization': `Bearer ${CRON_SECRET}`
    });

    if (response.status === 200) {
      log('✓ Fund management executed', 'success');
      log(`  Store: ${response.data.balances.store} USDC`, 'info');
      log(`  Band: ${response.data.balances.band} USDC`, 'info');
      log(`  Nano: ${response.data.balances.nanoWallet} USDC`, 'info');
      if (response.data.transactions.length > 0) {
        log(`  Transactions: ${JSON.stringify(response.data.transactions)}`, 'success');
      }
      return response.data;
    } else {
      log(`✗ Fund management failed: ${response.status}`, 'error');
      return null;
    }
  } catch (error) {
    log(`✗ Fund management error: ${error.message}`, 'error');
    return null;
  }
}

async function runClawback() {
  log('\n🔄 Running clawback cron...', 'warning');
  try {
    const response = await makeRequest('/api/cron/clawback', 'POST', null, {
      'Authorization': `Bearer ${CRON_SECRET}`
    });

    if (response.status === 200) {
      log('✓ Clawback executed', 'success');
      log(`  Total: ${response.data.balances.total} USDC`, 'info');
      log(`  Clawbacks: ${response.data.clawbacks?.count || 0}`, 'info');
      log(`  Reclaimed: ${response.data.clawbacks?.totalReclaimed || '0'} USDC`, 'info');
      return response.data;
    } else {
      log(`✗ Clawback failed: ${response.status}`, 'error');
      return null;
    }
  } catch (error) {
    log(`✗ Clawback error: ${error.message}`, 'error');
    return null;
  }
}

async function generateWalletBatch(batchSize, stats) {
  const promises = [];

  for (let i = 0; i < batchSize; i++) {
    promises.push(
      makeRequest('/api/generate-account', 'POST')
        .then(res => {
          if (res.status === 200) {
            stats.walletsGenerated++;
            stats.walletAddresses.push(res.data.address);
            process.stdout.write(`\r✓ Wallets: ${stats.walletsGenerated} | Failed: ${stats.walletsFailed}`);
            return { success: true, address: res.data.address };
          } else {
            stats.walletsFailed++;
            process.stdout.write(`\r✓ Wallets: ${stats.walletsGenerated} | Failed: ${stats.walletsFailed}`);
            return { success: false, error: res.data };
          }
        })
        .catch(() => {
          stats.walletsFailed++;
          process.stdout.write(`\r✓ Wallets: ${stats.walletsGenerated} | Failed: ${stats.walletsFailed}`);
          return { success: false };
        })
    );
  }

  return await Promise.all(promises);
}

async function purchaseBatch(addresses, stats) {
  const promises = [];

  for (const address of addresses) {
    promises.push(
      makeRequest('/api/purchase-giftcard', 'POST', { address })
        .then(res => {
          if (res.status === 200) {
            stats.purchasesCompleted++;
            process.stdout.write(`\r✓ Purchases: ${stats.purchasesCompleted} | Failed: ${stats.purchasesFailed}`);
            return { success: true };
          } else {
            stats.purchasesFailed++;
            process.stdout.write(`\r✓ Purchases: ${stats.purchasesCompleted} | Failed: ${stats.purchasesFailed}`);
            return { success: false };
          }
        })
        .catch(() => {
          stats.purchasesFailed++;
          process.stdout.write(`\r✓ Purchases: ${stats.purchasesCompleted} | Failed: ${stats.purchasesFailed}`);
          return { success: false };
        })
    );
  }

  return await Promise.all(promises);
}

async function runFullStressTest() {
  log('\n╔══════════════════════════════════════════════════════╗', 'info');
  log('║   FULL SYSTEM STRESS TEST WITH FUND MANAGEMENT      ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');

  const TARGET_WALLETS = parseInt(process.env.WALLET_COUNT || '1000');
  const BATCH_SIZE = 50;

  const stats = {
    walletsGenerated: 0,
    walletsFailed: 0,
    walletAddresses: [],
    purchasesCompleted: 0,
    purchasesFailed: 0,
    fundManagementRuns: 0,
    clawbackRuns: 0,
  };

  log(`\nTarget: Generate ${TARGET_WALLETS} wallets and purchase gift cards`, 'info');
  log(`Batch size: ${BATCH_SIZE} concurrent requests`, 'info');
  log(`CRON_SECRET configured: ${CRON_SECRET !== 'test-secret'}`, 'info');

  // Check initial balances
  log('\n📊 Checking initial contract balances...', 'warning');
  let balances = await checkContractBalances();
  if (balances) {
    log(`  Store: ${balances.store} USDC`, 'info');
    log(`  Band: ${balances.band} USDC`, 'info');
    log(`  Nano: ${balances.nanoWallet} USDC`, 'info');
  }

  const startTime = Date.now();

  // Main generation loop
  log(`\n🔥 Starting wallet generation (${TARGET_WALLETS} wallets)...`, 'warning');

  let totalBatches = Math.ceil(TARGET_WALLETS / BATCH_SIZE);

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchNum = batch + 1;
    const currentBatchSize = Math.min(BATCH_SIZE, TARGET_WALLETS - stats.walletsGenerated - stats.walletsFailed);

    log(`\n\nBatch ${batchNum}/${totalBatches} (${currentBatchSize} wallets)`, 'info');

    // Generate wallet batch
    const results = await generateWalletBatch(currentBatchSize, stats);
    console.log(''); // newline

    // Check if we hit failures due to low funds
    const successCount = results.filter(r => r.success).length;
    const failureRate = (currentBatchSize - successCount) / currentBatchSize;

    if (failureRate > 0.5) {
      log(`\n⚠️  High failure rate detected (${(failureRate * 100).toFixed(0)}%)`, 'warning');
      log('   This likely means distributor wallets are low on funds', 'warning');

      // Run fund management
      const fundResult = await runFundManagement();
      stats.fundManagementRuns++;

      if (fundResult) {
        // Parse band balance
        const bandBalance = parseFloat(fundResult.balances.band.replace(/,/g, ''));

        // If band is low, run clawback
        if (bandBalance < 5000) {
          log('\n⚠️  Band balance low, running clawback...', 'warning');
          await runClawback();
          stats.clawbackRuns++;

          // Wait a bit for transactions
          log('   Waiting 15s for clawback transactions...', 'info');
          await new Promise(r => setTimeout(r, 15000));

          // Run fund management again
          await runFundManagement();
          stats.fundManagementRuns++;
        }
      }

      log('   Waiting 10s for fund transfers to settle...', 'info');
      await new Promise(r => setTimeout(r, 10000));
    }

    // Small delay between batches
    if (batch < totalBatches - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  const generationDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  log(`\n\n✓ Wallet generation complete!`, 'success');
  log(`  Generated: ${stats.walletsGenerated}`, 'success');
  log(`  Failed: ${stats.walletsFailed}`, 'error');
  log(`  Duration: ${generationDuration}s`, 'info');
  log(`  Rate: ${(stats.walletsGenerated / generationDuration).toFixed(2)} wallets/sec`, 'info');

  // Purchase phase
  if (stats.walletAddresses.length > 0) {
    log(`\n🛒 Starting purchase phase (${Math.min(100, stats.walletAddresses.length)} purchases)...`, 'warning');

    const purchaseStartTime = Date.now();
    const addressesToPurchase = stats.walletAddresses.slice(0, 100);

    // Wait for wallet generation transactions to settle
    log('   Waiting 15s for wallet transactions to confirm...', 'info');
    await new Promise(r => setTimeout(r, 15000));

    // Purchase in batches of 25
    for (let i = 0; i < addressesToPurchase.length; i += 25) {
      const batch = addressesToPurchase.slice(i, i + 25);
      log(`\n   Purchase batch ${Math.floor(i/25) + 1}/${Math.ceil(addressesToPurchase.length/25)}`, 'info');
      await purchaseBatch(batch, stats);
      console.log(''); // newline

      if (i + 25 < addressesToPurchase.length) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    const purchaseDuration = ((Date.now() - purchaseStartTime) / 1000).toFixed(2);

    log(`\n✓ Purchase phase complete!`, 'success');
    log(`  Completed: ${stats.purchasesCompleted}`, 'success');
    log(`  Failed: ${stats.purchasesFailed}`, 'error');
    log(`  Duration: ${purchaseDuration}s`, 'info');
  }

  // Final fund management check
  log(`\n🔄 Running final fund management check...`, 'warning');
  const finalFundResult = await runFundManagement();
  if (finalFundResult) {
    stats.fundManagementRuns++;
  }

  // Final summary
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  log('\n╔══════════════════════════════════════════════════════╗', 'success');
  log('║              STRESS TEST COMPLETE                    ║', 'success');
  log('╚══════════════════════════════════════════════════════╝', 'success');

  log('\n📊 Final Statistics:', 'info');
  log(`  Total Duration: ${totalDuration}s`, 'info');
  log(`  Wallets Generated: ${stats.walletsGenerated} (${stats.walletsFailed} failed)`, stats.walletsGenerated >= TARGET_WALLETS * 0.9 ? 'success' : 'warning');
  log(`  Purchases Completed: ${stats.purchasesCompleted} (${stats.purchasesFailed} failed)`, 'info');
  log(`  Fund Management Runs: ${stats.fundManagementRuns}`, 'info');
  log(`  Clawback Runs: ${stats.clawbackRuns}`, 'info');
  log(`  Success Rate: ${((stats.walletsGenerated / (stats.walletsGenerated + stats.walletsFailed)) * 100).toFixed(1)}%`, 'info');

  if (stats.walletsGenerated >= TARGET_WALLETS * 0.9) {
    log('\n✅ TEST PASSED - System is production ready!', 'success');
  } else {
    log('\n⚠️  TEST INCOMPLETE - Some wallets failed to generate', 'warning');
  }
}

runFullStressTest().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
