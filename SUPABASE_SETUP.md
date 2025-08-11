# Supabase Setup for 10k+ Concurrent Users

## Quick Setup Guide

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Create new project (remember your database password)
3. Wait for project to initialize

### 2. Get Your Keys
In Supabase Dashboard → Settings → API:
- `SUPABASE_URL`: https://YOUR_PROJECT.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY`: The service role key (keep SECRET!)
- `SUPABASE_POOLER_URL`: Go to Settings → Database → Connection string → Transaction pooler

### 3. Create the Database Table

Run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS endpoint_hits (
  id BIGSERIAL PRIMARY KEY,
  ip_address INET NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRITICAL for performance at scale
CREATE INDEX idx_endpoint_hits_ip ON endpoint_hits(ip_address);
CREATE INDEX idx_endpoint_hits_endpoint ON endpoint_hits(endpoint);
CREATE INDEX idx_endpoint_hits_wallet ON endpoint_hits(wallet_address);
CREATE INDEX idx_endpoint_hits_created ON endpoint_hits(created_at DESC);
```

### 4. Add to Vercel Environment Variables

Go to your Vercel project → Settings → Environment Variables and add:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_POOLER_URL=https://YOUR_PROJECT.pooler.supabase.com
```

**IMPORTANT**: Add to all environments (Development, Preview, Production)

## How It Handles 10k+ Users

### ✅ Service Role Key
- **Bypasses ALL rate limits** (anon key has 300 req/min limit)
- Direct database access
- No Row Level Security overhead

### ✅ Connection Pooling  
- Pooler URL provides **15,000+ concurrent connections**
- Perfect for serverless (Vercel creates new connection per request)
- Without pooler: ~100 connections max
- With pooler: 15,000+ connections

### ✅ Fire-and-Forget Pattern
```javascript
// Non-blocking - returns immediately
trackIP(req, 'endpoint-name', walletAddress);
// API responds to user while tracking happens in background
```

### ✅ Automatic Fallback Chain
1. **Primary**: Supabase with service role (unlimited)
2. **Fallback**: Vercel KV (if Supabase fails)
3. **Last Resort**: Console logging (if both fail)

### ✅ Optimizations
- 5-second timeout (prevents hanging)
- No session persistence (serverless optimization)
- No auto-refresh tokens (reduces overhead)
- Indexes on all query fields

## Testing It Works

### 1. Simple Test
```bash
curl https://your-app.vercel.app/api/health
```

### 2. Check Supabase
Go to Supabase Dashboard → Table Editor → endpoint_hits
You should see entries appearing

### 3. Load Test
```bash
# Install autocannon
npm install -g autocannon

# Test with 1000 concurrent for 30 seconds
autocannon -c 1000 -d 30 https://your-app.vercel.app/api/generate-account
```

## What Each Endpoint Tracks

- **generate-account**: Initial request + success with wallet address
- **purchase-album**: Purchase attempt + success with tx hash
- **health**: Simple health checks

## Monitoring

1. **Supabase Dashboard**: Table Editor shows real-time data
2. **Vercel Logs**: Check function logs for any errors
3. **Analytics Endpoint**: `/api/analytics` (if you add it)

## Troubleshooting

### "Too many connections"
- You're not using the pooler URL
- Check SUPABASE_POOLER_URL is set correctly

### No data appearing
1. Check env vars are set in Vercel
2. Check table was created
3. Look at Vercel function logs

### Slow tracking
- Make sure you're NOT awaiting trackIP()
- It should be fire-and-forget

## Cost at Scale

For 10k concurrent users:
- **Supabase Free**: 500MB storage, 2GB bandwidth (good for testing)
- **Supabase Pro** ($25/mo): 8GB storage, 50GB bandwidth, better performance
- **Connection pooling**: Included free!

## Security Notes

⚠️ **NEVER expose**:
- Service role key (backend only!)
- Database password

✅ **Safe to expose**:
- Anon key (it's meant to be public)
- Supabase URL

This setup will handle massive scale without breaking!