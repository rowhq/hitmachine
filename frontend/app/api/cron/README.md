# Cron Jobs

## Clawback Cron Job

The clawback cron job runs every minute to reclaim USDC from funded wallets when system liquidity is low.

### Configuration

1. Set the `CRON_SECRET` environment variable in Vercel:
   ```
   CRON_SECRET=your-secret-key-here
   ```

2. The cron job will automatically run every minute

### How it works

1. Checks combined USDC balance of Store + AnimalCare contracts
2. If balance < 15,000 USDC:
   - Finds all wallets funded over 1 hour ago
   - Skips wallets that have already made purchases
   - Calls the `revoke()` function to return USDC to AnimalCare
   - Logs all activities to Supabase

### Manual Triggering

You can manually trigger the clawback by making a POST request with the cron secret:

```bash
curl -X POST https://your-app.vercel.app/api/cron/clawback \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Monitoring

All clawback events are logged to Supabase with the following event types:
- `usdc_clawback` - Individual wallet clawback
- `clawback_summary` - Summary of each run
- `clawback_error` - Any errors encountered

### Important Notes

- The `revoke()` function must be implemented in the AnimalCare contract first
- Only wallets funded by the system can be clawed back
- The cron job uses the paymaster for gas fees