#!/usr/bin/env node

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function massBuy() {
  console.log('=== Mass Buy CLI ===\n');
  
  const apiUrl = await question('API URL (e.g., https://yourapi.vercel.app): ');
  const apiKey = await question('API Key: ');
  const startIndex = await question('Start Index: ');
  const endIndex = await question('End Index: ');
  
  console.log('\nProcessing wallets from', startIndex, 'to', endIndex);
  console.log('This will:');
  console.log('1. Make purchases from each wallet');
  console.log('2. Return any remaining USDC to NANO wallet');
  
  const confirm = await question('\nContinue? (y/n): ');
  
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled');
    rl.close();
    return;
  }
  
  const data = JSON.stringify({
    startIndex: parseInt(startIndex),
    endIndex: parseInt(endIndex)
  });
  
  const url = new URL(`${apiUrl}/api/mass-buy`);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'Content-Length': data.length
    }
  };
  
  console.log('\nSending request...');
  
  const req = https.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(responseData);
        
        if (res.statusCode === 200) {
          console.log('\n✅ Success!');
          console.log('\nSummary:');
          console.log('- Processed:', result.summary.processed);
          console.log('- Successful purchases:', result.summary.successful);
          console.log('- Already purchased:', result.summary.alreadyPurchased);
          console.log('- Refunded:', result.summary.refunded);
          console.log('- Errors:', result.summary.errors);
          
          if (result.results && result.results.length > 0) {
            console.log('\nDetailed Results:');
            result.results.forEach(r => {
              console.log(`Wallet ${r.index} (${r.address}): ${r.status}`);
              if (r.txHash) console.log(`  TX: ${r.txHash}`);
            });
          }
          
          if (result.refunds && result.refunds.length > 0) {
            console.log('\nRefunds:');
            result.refunds.forEach(r => {
              console.log(`Wallet ${r.index}: ${r.amount} USDC`);
              console.log(`  TX: ${r.txHash}`);
            });
          }
          
          if (result.errors && result.errors.length > 0) {
            console.log('\n⚠️ Errors:');
            result.errors.forEach(e => {
              console.log(`Wallet ${e.index}: ${e.error}`);
            });
          }
        } else {
          console.log('\n❌ Error:', result.error || 'Request failed');
          if (result.message) console.log('Message:', result.message);
        }
      } catch (e) {
        console.log('\n❌ Error parsing response:', responseData);
      }
      
      rl.close();
    });
  });
  
  req.on('error', (e) => {
    console.error('Request error:', e);
    rl.close();
  });
  
  req.write(data);
  req.end();
}

// Run
massBuy().catch(console.error);