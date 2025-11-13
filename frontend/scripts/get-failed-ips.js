/**
 * Get all IP addresses from failed wallet generation attempts
 * Time range: November 12, 2025 01:52:11 PM UTC to now
 *
 * Run from root: node scripts/get-failed-ips.js
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing Supabase credentials');
  console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Target time: November 12, 2025 01:52:11 PM UTC
const START_TIME = '2025-11-12T13:52:11.000Z';

async function getFailedIPs() {
  console.log(`Querying wallet_events from ${START_TIME} to now...`);
  console.log('');

  try {
    // First, get count of all events
    const { count, error: countError } = await supabase
      .from('wallet_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', START_TIME);

    if (countError) {
      console.error('Error counting events:', countError);
    } else {
      console.log(`Total events in time range: ${count}`);
    }

    // Get all events from the time range (paginated)
    let allEvents = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: events, error } = await supabase
        .from('wallet_events')
        .select('ip_address, event_type, created_at, metadata')
        .gte('created_at', START_TIME)
        .order('created_at', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error querying Supabase:', error);
        process.exit(1);
      }

      if (!events || events.length === 0) {
        hasMore = false;
      } else {
        allEvents = allEvents.concat(events);
        console.log(`Fetched page ${page + 1}: ${events.length} events (total so far: ${allEvents.length})`);
        page++;
        if (events.length < pageSize) {
          hasMore = false;
        }
      }
    }

    const events = allEvents;

    if (!events || events.length === 0) {
      console.log('No events found in this time range.');
      return;
    }

    console.log(`Total events found: ${events.length}`);
    console.log('');

    // Show event type breakdown
    const eventTypeCounts = {};
    for (const event of events) {
      eventTypeCounts[event.event_type] = (eventTypeCounts[event.event_type] || 0) + 1;
    }
    console.log('Event types breakdown:');
    Object.entries(eventTypeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log('');

    // Group events by IP address
    const ipGroups = new Map();

    for (const event of events) {
      const ip = event.ip_address;
      if (!ipGroups.has(ip)) {
        ipGroups.set(ip, {
          attempts: [],
          successful: false,
          walletGenerated: false,
          walletAddress: null
        });
      }

      const group = ipGroups.get(ip);
      group.attempts.push({
        type: event.event_type,
        time: event.created_at,
        success: event.metadata?.success,
        wallet: event.metadata?.wallet_address
      });

      // Track if wallet was generated
      if (event.event_type === 'wallet_generated') {
        group.walletGenerated = true;
        if (event.metadata?.wallet_address) {
          group.walletAddress = event.metadata.wallet_address;
        }
      }

      // Check if wallet was successfully funded (this is the key success metric)
      if (event.event_type === 'wallet_funded') {
        group.successful = true;
      }
    }

    console.log(`Unique IP addresses: ${ipGroups.size}`);
    console.log('');

    // Find IPs based on their success state
    const failedIPs = []; // Had wallet_generated but NOT wallet_funded
    const successfulIPs = []; // Had wallet_funded
    const noWalletIPs = []; // Never got wallet_generated

    for (const [ip, group] of ipGroups) {
      if (group.successful) {
        // Wallet was funded - success!
        successfulIPs.push({ ip, wallet: group.walletAddress });
      } else if (group.walletGenerated) {
        // Wallet was generated but NOT funded - this is the bug!
        failedIPs.push(ip);
      } else {
        // Never even got a wallet generated
        noWalletIPs.push(ip);
      }
    }

    console.log('=== RESULTS ===');
    console.log('');
    console.log(`Failed IPs (wallet generated but NOT funded): ${failedIPs.length}`);
    console.log(`Successful IPs (wallet funded): ${successfulIPs.length}`);
    console.log(`No wallet IPs (never generated): ${noWalletIPs.length}`);
    console.log('');

    if (failedIPs.length > 0) {
      console.log('=== FAILED IP ADDRESSES ===');
      console.log('(Copy these for replay):');
      console.log('');
      failedIPs.forEach(ip => console.log(ip));
      console.log('');

      // Also output as JSON array
      console.log('=== JSON FORMAT ===');
      console.log(JSON.stringify(failedIPs, null, 2));
      console.log('');

      // Output as comma-separated
      console.log('=== COMMA-SEPARATED ===');
      console.log(failedIPs.join(','));
      console.log('');
    }

    // Show some details about the failed attempts
    if (failedIPs.length > 0 && failedIPs.length <= 20) {
      console.log('=== FAILED ATTEMPT DETAILS ===');
      for (const ip of failedIPs) {
        const group = ipGroups.get(ip);
        console.log(`\nIP: ${ip}`);
        console.log(`Attempts: ${group.attempts.length}`);
        group.attempts.forEach((attempt, i) => {
          console.log(`  ${i+1}. ${attempt.type} at ${attempt.time}`);
        });
      }
    }

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

// Run the script
getFailedIPs();
