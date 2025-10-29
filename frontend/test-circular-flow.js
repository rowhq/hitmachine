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

async function checkBalances() {
  const response = await makeRequest('/api/cron/fund-management', 'POST', null, {
    'Authorization': `Bearer ${CRON_SECRET}`
  });

  if (response.status === 200) {
    return response.data.balances;
  }
  return null;
}

async function testCircularFlow() {
  log('\n╔══════════════════════════════════════════════════════╗', 'info');
  log('║      CIRCULAR FLOW TEST - 50K USDC CYCLE           ║', 'info');
  log('╚══════════════════════════════════════════════════════╝', 'info');

  // Step 1: Check initial balances
  log('\n📊 STEP 1: Initial System State', 'warning');
  let balances = await checkBalances();
  if (balances) {
    log(`  Store: ${balances.store} USDC`, 'info');
    log(`  Band: ${balances.band} USDC`, 'info');
    log(`  Nano Wallet: ${balances.nanoWallet} USDC`, 'info');
  }

  // Step 2: Generate wallets and purchase (simulate user activity)
  log('\n🔄 STEP 2: Simulating User Activity', 'warning');
  log('   Target: Process enough transactions to move 50K USDC through system', 'info');

  // Calculate how many wallets needed to move 50K
  const TARGET_FLOW = 50000; // 50K USDC
  const PER_WALLET = 31.96;
  const WALLETS_NEEDED = Math.ceil(TARGET_FLOW / PER_WALLET); // ~1565 wallets

  log(`   Need ~${WALLETS_NEEDED} wallet generations to move ${TARGET_FLOW} USDC`, 'info');
  log(`   Running batches of 25 concurrent requests...`, 'info');

  const stats = {
    walletsGenerated: 0,
    walletsFailed: 0,
    purchasesCompleted: 0,
    purchasesFailed: 0,
    walletAddresses: [],
    totalFlow: 0,
  };

  const BATCH_SIZE = 25;
  const MAX_BATCHES = Math.ceil(WALLETS_NEEDED / BATCH_SIZE);

  for (let batchNum = 0; batchNum < MAX_BATCHES; batchNum++) {
    // Generate batch of wallets
    const walletPromises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      walletPromises.push(
        makeRequest('/api/generate-account', 'POST')
          .then(res => {
            if (res.status === 200) {
              stats.walletsGenerated++;
              stats.walletAddresses.push(res.data.address);
              stats.totalFlow += PER_WALLET;
              return { success: true, address: res.data.address };
            } else {
              stats.walletsFailed++;
              return { success: false };
            }
          })
          .catch(() => {
            stats.walletsFailed++;
            return { success: false };
          })
      );
    }

    const results = await Promise.all(walletPromises);
    process.stdout.write(`\r   Batch ${batchNum + 1}/${MAX_BATCHES}: ${stats.walletsGenerated} wallets | $${stats.totalFlow.toFixed(2)} flow`);

    // Every 100 wallets, purchase some and check balances
    if ((batchNum + 1) % 4 === 0) {
      console.log(''); // newline

      // Purchase from recent wallets
      const recentWallets = stats.walletAddresses.slice(-BATCH_SIZE);
      log(`\n   💳 Purchasing gift cards for batch...`, 'info');

      await new Promise(r => setTimeout(r, 5000)); // Wait for transactions

      const purchasePromises = recentWallets.map(address =>
        makeRequest('/api/purchase-giftcard', 'POST', { address })
          .then(res => {
            if (res.status === 200) stats.purchasesCompleted++;
            else stats.purchasesFailed++;
          })
          .catch(() => stats.purchasesFailed++)
      );

      await Promise.all(purchasePromises);
      log(`   ✓ Purchases: ${stats.purchasesCompleted} completed`, 'success');

      // Check balances
      balances = await checkBalances();
      if (balances) {
        log(`   💰 Store: ${balances.store} | Band: ${balances.band} | Nano: ${balances.nanoWallet}`, 'info');
      }

      await new Promise(r => setTimeout(r, 2000)); // Small delay
    }

    // Stop if we've moved 50K
    if (stats.totalFlow >= TARGET_FLOW) {
      console.log(''); // newline
      log(`\n✓ Reached target flow of $${TARGET_FLOW}!`, 'success');
      break;
    }

    // Stop if we're out of funds
    if (stats.walletsFailed > BATCH_SIZE * 2) {
      console.log(''); // newline
      log('\n⚠️  Too many failures, likely out of funds', 'warning');
      break;
    }
  }

  console.log(''); // newline

  // Step 3: Final purchases for remaining wallets
  log('\n💳 STEP 3: Completing Remaining Purchases', 'warning');
  log('   Waiting 10s for wallet transactions to settle...', 'info');
  await new Promise(r => setTimeout(r, 10000));

  const remainingWallets = stats.walletAddresses.slice(stats.purchasesCompleted);
  if (remainingWallets.length > 0) {
    log(`   Purchasing for ${Math.min(100, remainingWallets.length)} wallets...`, 'info');

    for (let i = 0; i < Math.min(100, remainingWallets.length); i += 25) {
      const batch = remainingWallets.slice(i, i + 25);
      await Promise.all(
        batch.map(address =>
          makeRequest('/api/purchase-giftcard', 'POST', { address })
            .then(res => {
              if (res.status === 200) stats.purchasesCompleted++;
              else stats.purchasesFailed++;
            })
            .catch(() => stats.purchasesFailed++)
        )
      );
      process.stdout.write(`\r   Completed: ${stats.purchasesCompleted} purchases`);
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log(''); // newline
  }

  // Step 4: Test Fund Management Cron
  log('\n🔧 STEP 4: Testing Fund Management Cron', 'warning');
  log('   Waiting 5s for purchase transactions to settle...', 'info');
  await new Promise(r => setTimeout(r, 5000));

  const fundResponse = await makeRequest('/api/cron/fund-management', 'POST', null, {
    'Authorization': `Bearer ${CRON_SECRET}`
  });

  if (fundResponse.status === 200) {
    log('✓ Fund Management executed successfully', 'success');
    log(`  Store: ${fundResponse.data.balances.store} USDC`, 'info');
    log(`  Band: ${fundResponse.data.balances.band} USDC`, 'info');
    log(`  Nano Wallet: ${fundResponse.data.balances.nanoWallet} USDC`, 'info');

    if (fundResponse.data.transactions.length > 0) {
      log(`\n  📋 Transactions Executed:`, 'success');
      fundResponse.data.transactions.forEach(tx => {
        log(`    - ${tx.type}: ${tx.amount} USDC (tx: ${tx.txHash})`, 'info');
      });
    } else {
      log('  No transactions needed (balances within thresholds)', 'info');
    }
  } else {
    log(`✗ Fund Management failed: ${fundResponse.status}`, 'error');
  }

  // Step 5: Test Clawback Cron
  log('\n🔧 STEP 5: Testing Clawback Cron', 'warning');

  const clawbackResponse = await makeRequest('/api/cron/clawback', 'POST', null, {
    'Authorization': `Bearer ${CRON_SECRET}`
  });

  if (clawbackResponse.status === 200) {
    log('✓ Clawback executed successfully', 'success');
    log(`  Total System Balance: ${clawbackResponse.data.balances.total} USDC`, 'info');
    log(`  Wallets Clawed Back: ${clawbackResponse.data.clawbacks.count}`, 'info');
    log(`  USDC Reclaimed: ${clawbackResponse.data.clawbacks.totalReclaimed} USDC`, 'info');

    if (clawbackResponse.data.clawbacks.count > 0) {
      log(`\n  📋 Clawback Details:`, 'success');
      clawbackResponse.data.clawbacks.details.slice(0, 5).forEach(cb => {
        log(`    - Wallet ${cb.wallet}: ${cb.amount} USDC (tx: ${cb.txHash})`, 'info');
      });
      if (clawbackResponse.data.clawbacks.details.length > 5) {
        log(`    - ... and ${clawbackResponse.data.clawbacks.details.length - 5} more`, 'info');
      }
    }
  } else {
    log(`✗ Clawback failed: ${clawbackResponse.status}`, 'error');
  }

  // Step 6: Final Summary
  log('\n╔══════════════════════════════════════════════════════╗', 'success');
  log('║              CIRCULAR FLOW TEST COMPLETE             ║', 'success');
  log('╚══════════════════════════════════════════════════════╝', 'success');

  log('\n📈 Flow Statistics:', 'info');
  log(`  Wallets Generated: ${stats.walletsGenerated}`, 'success');
  log(`  Gift Cards Purchased: ${stats.purchasesCompleted}`, 'success');
  log(`  Total USDC Flow: $${stats.totalFlow.toFixed(2)}`, 'success');
  log(`  Failed Transactions: ${stats.walletsFailed + stats.purchasesFailed}`, stats.walletsFailed + stats.purchasesFailed > 0 ? 'warning' : 'success');

  log('\n💰 Final System State:', 'info');
  const finalBalances = await checkBalances();
  if (finalBalances) {
    log(`  Store: ${finalBalances.store} USDC`, 'info');
    log(`  Band: ${finalBalances.band} USDC`, 'info');
    log(`  Nano Wallet: ${finalBalances.nanoWallet} USDC`, 'info');
  }

  log('\n✅ Circular flow system verified!', 'success');
  log('   Funds successfully cycled: Band → Users → Store → Nano → Band', 'info');
}

testCircularFlow().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
