# 🚂 Railway Deployment Guide

Deploy your Whale Agent to Railway in **under 10 minutes**!

## 🎯 Why Railway?

✅ **Built-in PostgreSQL** - One-click database provisioning  
✅ **Auto-Deploy** - Push to GitHub, auto-deploy  
✅ **Environment Variables** - Secure config management  
✅ **Free Tier** - $5/month credit (enough for this agent)  
✅ **Zero Config** - Detects Node.js automatically  
✅ **Always On** - 24/7 uptime  

---

## 🚀 Quick Deploy (10 Minutes)

### Step 1: Prepare Your Repository (2 min)

```bash
# Initialize git if you haven't already
cd whale-agent
git init
git add .
git commit -m "Initial commit"

# Push to GitHub (create a repo first at github.com)
git remote add origin https://github.com/YOUR_USERNAME/whale-agent.git
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Project (3 min)

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your `whale-agent` repository
6. Railway will automatically detect it's a Node.js app

### Step 3: Provision PostgreSQL Database (1 min)

1. In your Railway project dashboard
2. Click **"+ New"**
3. Select **"Database"** → **"Add PostgreSQL"**
4. Railway automatically creates `DATABASE_URL` variable
5. Your database is now connected! 🎉

### Step 4: Configure Environment Variables (3 min)

In your Railway project:

1. Click on your service (the whale-agent app)
2. Go to **"Variables"** tab
3. Add these variables:

```env
# Telegram (Required)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# RPC Endpoint (Required)
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Optional
BASE_RPC_BACKUP=https://mainnet.base.org
GRAPH_API_KEY=your_graph_api_key_if_you_have_one
ANALYSIS_SCHEDULE=0 */6 * * *
```

**Note:** `DATABASE_URL` is automatically added by Railway when you provision the PostgreSQL database!

### Step 5: Initialize Database Schema (1 min)

Railway doesn't auto-run migrations, so we need to initialize the schema:

**Option A: Using Railway CLI (Recommended)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run schema initialization
railway run npm run init-db
```

**Option B: Manual via Dashboard**

1. Go to Railway dashboard → PostgreSQL service
2. Click **"Connect"** → **"psql"**
3. Copy contents of `database/schema.sql`
4. Paste and execute in the psql console

### Step 6: Deploy! 🚀

Railway automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Ready for production"
git push
```

Or trigger manual deploy in Railway dashboard:
- Go to your service → **"Deployments"**
- Click **"Deploy"**

---

## 📊 Post-Deployment

### Monitor Your Agent

**Railway Dashboard:**
- **Logs**: Real-time logs of your agent
- **Metrics**: CPU, memory, network usage
- **Database**: Query editor, table browser

**What to Look For:**
```
✅ "Railway database connected"
✅ "G.A.M.E Agent is now active"
✅ "Starting scheduled analysis batch"
```

### Check Telegram

Within 1-2 minutes of deployment, you should receive your first whale analysis report!

### Verify Database

1. Go to Railway → PostgreSQL service → **"Data"**
2. Check tables:
   - `token_snapshots` - Should have entries
   - `whale_positions` - Should have holder data
   - `whale_reports` - Should have reports

---

## 🔧 Configuration Options

### Change Analysis Schedule

Update environment variable in Railway:
```env
# Every 3 hours
ANALYSIS_SCHEDULE=0 */3 * * *

# Twice daily (6am, 6pm UTC)
ANALYSIS_SCHEDULE=0 6,18 * * *

# Every hour (for testing)
ANALYSIS_SCHEDULE=0 * * * *
```

### Add More Tokens

Update `TOKENS` variable:
```env
TOKENS=0x0b3AE50BaBE7FFa4E1A50569ceE6bDEFd4ccAeE0,0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3,0xYOUR_NEW_TOKEN
```

Railway will auto-restart with new config!

---

## 💰 Cost Breakdown

**Railway Free Tier:**
- $5/month in credits
- Enough for: 1 web service + 1 PostgreSQL database
- Usage: ~$3-4/month for this agent

**If You Exceed Free Tier:**
- Pay-as-you-go: ~$0.01/hour for web service
- Database: ~$0.01/hour
- Total: ~$15/month if running 24/7

**Cost Optimization:**
- Use free tier RPC (public Base node)
- Reduce analysis frequency if needed
- Railway's free tier should be sufficient for 2-10 tokens

---

## 🐛 Troubleshooting

### "DATABASE_URL not found"

**Fix:** Ensure PostgreSQL service is provisioned
1. Railway dashboard → **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway auto-injects `DATABASE_URL`

### "Error storing token snapshot"

**Fix:** Database schema not initialized
```bash
# Run schema initialization
railway run npm run init-db
```

Or manually run `database/schema.sql` in Railway's PostgreSQL console

### "Telegram connection test failed"

**Fix:** Check environment variables
1. Verify `TELEGRAM_BOT_TOKEN` is correct
2. Verify `TELEGRAM_CHAT_ID` is correct
3. Ensure you've sent a message to your bot first

### Agent stops after deployment

**Fix:** Check logs in Railway dashboard
- Look for errors in red
- Common issues: missing env vars, database connection

### "The Graph query failed"

**Fix:** This is normal! Agent uses RPC fallback automatically
- If you see this often, consider adding `GRAPH_API_KEY`

---

## 📚 Database Management

### Connect to Database Locally

```bash
# Get connection string from Railway
railway variables

# Connect with psql
psql DATABASE_URL_FROM_RAILWAY

# Or use a GUI tool like TablePlus, Postico, pgAdmin
```

### Backup Database

**Option A: Railway Dashboard**
1. PostgreSQL service → **"Data"** → **"Backups"**
2. Click **"Create Backup"**

**Option B: Command Line**
```bash
# Get DATABASE_URL from Railway
railway variables | grep DATABASE_URL

# Backup
pg_dump DATABASE_URL > backup.sql

# Restore
psql DATABASE_URL < backup.sql
```

### Query Reports

```bash
railway run psql

# Inside psql:
SELECT 
  token_address, 
  risk_score, 
  report_timestamp 
FROM whale_reports 
ORDER BY report_timestamp DESC 
LIMIT 10;
```

---

## 🔄 Continuous Deployment

### Auto-Deploy on Git Push

Railway automatically deploys when you push to `main`:

```bash
# Make changes
git add .
git commit -m "Update analysis logic"
git push

# Railway automatically:
# 1. Detects push
# 2. Runs build
# 3. Deploys new version
# 4. Zero downtime!
```

### Manual Deploy

Railway dashboard → Service → **"Deployments"** → **"Deploy"**

### Rollback

Railway dashboard → **"Deployments"** → Click previous deployment → **"Redeploy"**

---

## 🎯 Production Checklist

Before going live:

- [ ] PostgreSQL database provisioned
- [ ] Database schema initialized (`npm run init-db`)
- [ ] All environment variables set
- [ ] Telegram bot configured and tested
- [ ] First deployment successful
- [ ] Logs show "G.A.M.E Agent is now active"
- [ ] Received first Telegram report
- [ ] Database has entries in all tables
- [ ] Set up monitoring/alerts (optional)

---

## 🚨 Monitoring & Alerts

### Railway Built-in

**Metrics:**
- CPU usage
- Memory usage
- Network traffic
- Deployment history

**Logs:**
- Real-time streaming
- Search and filter
- Download logs

### External Monitoring (Optional)

**Uptime Monitoring:**
- UptimeRobot (free)
- Cronitor

**Error Tracking:**
- Sentry
- LogRocket

**Database Monitoring:**
- PgAnalyze
- DataDog

---

## 📈 Scaling

### Current Setup (Good for 2-10 tokens)
- 1 Railway service
- 1 PostgreSQL database
- 6-hour intervals

### Scale to 100+ Tokens
1. Increase Railway resources:
   - Dashboard → Service → **"Settings"** → **"Resources"**
   - Upgrade RAM/CPU

2. Add caching layer:
   - Provision Redis on Railway
   - Cache DexScreener responses

3. Optimize database:
   - Add more indexes
   - Implement connection pooling
   - Archive old snapshots

### Multi-Region Deployment

Deploy to multiple Railway regions for redundancy:
1. Create new project in different region
2. Same configuration
3. Share database or use separate DBs

---

## 🎓 Advanced Tips

### Environment-Specific Config

```typescript
// In your code:
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  // Production settings
} else {
  // Development settings
}
```

### Scheduled Tasks

Railway doesn't have cron natively, but your agent has built-in scheduling!

The `node-cron` package handles it:
```typescript
// Already configured in scheduler.ts
cron.schedule('0 */6 * * *', () => {
  // Runs every 6 hours
});
```

### Secrets Management

For sensitive data:
1. Railway dashboard → **"Variables"**
2. Click **"Raw Editor"**
3. Add multiline secrets if needed

---

## 💡 Pro Tips

1. **Use Railway CLI** for faster development
   ```bash
   railway run npm run dev  # Run locally with Railway env vars
   ```

2. **Set up GitHub Actions** for automated testing before deploy

3. **Monitor costs** in Railway dashboard
   - Set up spending alerts
   - Track usage trends

4. **Use Railway Teams** for collaboration
   - Share projects
   - Multiple developers

5. **Implement health checks**
   - Add `/health` endpoint
   - Monitor from external service

---

## 🆘 Need Help?

**Railway Documentation:**
- [Getting Started](https://docs.railway.app/getting-started)
- [PostgreSQL](https://docs.railway.app/databases/postgresql)
- [Environment Variables](https://docs.railway.app/develop/variables)

**Community:**
- [Railway Discord](https://discord.gg/railway)
- [GitHub Discussions](https://github.com/railwayapp/railway/discussions)

**This Project:**
- Check README.md for agent-specific help
- Review logs in Railway dashboard
- Check database connections

---

## ✅ You're All Set!

Your Whale Agent is now running 24/7 on Railway! 🎉

**What happens now:**
- Agent analyzes $WIRE and $GAME every 6 hours
- Sends comprehensive reports to your Telegram
- Builds 30-day historical data automatically
- Runs completely autonomously

**Next steps:**
- Monitor first few reports
- Customize analysis parameters if needed
- Add more tokens as desired
- Share your findings!

---

**Happy whale tracking! 🐋🚀**
