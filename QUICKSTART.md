# 🚀 Quick Start Guide - Railway Deployment

Get your Whale Agent running on Railway in **10 minutes**!

## ⚡ Option 1: Deploy to Railway (Recommended)

### Prerequisites
- GitHub account
- Telegram bot (2 minutes to create)
- Base RPC endpoint (free from Alchemy)

### Step 1: Push to GitHub (2 min)

```bash
cd whale-agent
git init
git add .
git commit -m "Initial commit"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/whale-agent.git
git push -u origin main
```

### Step 2: Deploy to Railway (3 min)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select `whale-agent`
4. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
5. Done! Railway auto-detects Node.js and builds

### Step 3: Configure (3 min)

In Railway dashboard → your service → **"Variables"**:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### Step 4: Initialize Database (1 min)

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link
railway login
railway link

# Initialize schema
railway run npm run init-db
```

### Step 5: Deploy! 🚀

Railway auto-deploys! Check your Telegram in 1-2 minutes for your first report!

---

## ⚡ Option 2: Run Locally (For Testing)

### Prerequisites
- Node.js 18+
- PostgreSQL (local or Railway)
- Telegram bot
- Base RPC endpoint

### Step 1: Install (1 min)

```bash
cd whale-agent
npm install
```

### Step 2: Configure (2 min)

Create `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/whaleagent
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
BASE_RPC_URL=your_rpc_url
TOKENS=0x0b3AE50BaBE7FFa4E1A50569ceE6bDEFd4ccAeE0,0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3
```

### Step 3: Setup Database (1 min)

```bash
# If using local PostgreSQL
createdb whaleagent
npm run init-db

# Or connect to Railway database
# Get DATABASE_URL from Railway and put in .env
npm run init-db
```

### Step 4: Run! (1 min)

```bash
# Development mode (with auto-reload)
npm run dev

# Or production mode
npm run build
npm start
```

---

## 📱 Setup Telegram Bot (2 minutes)

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send: `/newbot`
3. Choose name and username
4. Copy the token
5. Send a message to your bot (any text)
6. Get your chat ID:
   - Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
   - Find `"chat":{"id":123456789}`

---

## 🔑 Get Base RPC (Free)

### Option A: Alchemy (Recommended)
1. Sign up at [alchemy.com](https://alchemy.com)
2. Create app → Select "Base" network
3. Copy HTTPS endpoint

### Option B: Public RPC (Free, slower)
```env
BASE_RPC_URL=https://mainnet.base.org
```

---

## ✅ Verify It's Working

**You should see:**

```bash
🤖 INITIALIZING G.A.M.E WHALE AGENT
✅ Railway database connected
✅ Telegram: ✅
🚀 WHALE AGENT SCHEDULER STARTED
⚡ Running initial analysis immediately...

📊 Fetching price and volume data...
🐋 Fetching top 50 holder data...
✅ Analysis complete for WIRE
```

**In Telegram:**
You'll receive a comprehensive whale report within 1-2 minutes!

---

## 🐛 Troubleshooting

**"DATABASE_URL not found"**
→ Provision PostgreSQL in Railway dashboard

**"Telegram connection failed"**
→ Send a message to your bot first
→ Double-check bot token and chat ID

**"No pairs found for token"**
→ Verify token address is correct
→ Check token has liquidity on Base

**Database connection failed (local)**
→ Make sure PostgreSQL is running:
```bash
# macOS
brew services start postgresql

# Linux
sudo service postgresql start
```

---

## 🚀 What Happens Next?

✅ Agent runs 24/7 analyzing $WIRE and $GAME  
✅ Sends reports to Telegram every 6 hours  
✅ Builds 30-day historical data automatically  
✅ Tracks whale accumulation/distribution  
✅ Calculates risk scores and trends  

---

## 📚 Next Steps

1. **Monitor** - Check Railway logs and Telegram
2. **Customize** - Adjust schedule in environment variables
3. **Scale** - Add more tokens to `TOKENS` variable
4. **Explore** - Read RAILWAY.md for advanced deployment options

---

## 💡 Pro Tips

**Railway CLI commands:**
```bash
# View logs
railway logs

# Run commands with Railway env vars
railway run npm run dev

# Open Railway dashboard
railway open
```

**Update configuration:**
- Change variables in Railway dashboard
- No redeployment needed - auto-restarts!

**Database access:**
```bash
# Connect to Railway database
railway run psql
```

---

**You're all set! Your Whale Agent is now running! 🐋🚀**

Questions? Check:
- **RAILWAY.md** - Complete deployment guide
- **README.md** - Full documentation
- **ARCHITECTURE.md** - Technical details
