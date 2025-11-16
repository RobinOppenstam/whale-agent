# 🐋 Whale Agent - G.A.M.E (Virtuals Protocol)

An autonomous AI agent for tracking whale activity, analyzing token metrics, and detecting accumulation/distribution patterns on Base blockchain.

## 🎯 Features

- **Automated 6-Hour Reports**: Deep whale position analysis every 6 hours
- **Real-time Metrics**: Price, volume, and liquidity tracking via DexScreener
- **Whale Tracking**: Monitor top 50 holders using The Graph (with RPC fallback)
- **Risk Analysis**: Comprehensive risk scoring based on concentration and behavior
- **Telegram Integration**: Automated report delivery to your personal chat
- **G.A.M.E Compatible**: Built for Virtuals Protocol with on-demand queries
- **Historical Tracking**: Build 30-day trend data for pattern recognition

## 📊 Tracked Tokens

- **$WIRE**: `0x0b3AE50BaBE7FFa4E1A50569ceE6bDEFd4ccAeE0`
- **$GAME**: `0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3`

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      G.A.M.E Agent                          │
│  (Virtuals Protocol Compatible AI Agent)                    │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ┌────▼─────┐    ┌─────▼─────┐
   │ On-Demand│    │ Scheduled │
   │ Queries  │    │ (6 hours) │
   └────┬─────┘    └─────┬─────┘
        │                │
        └────────┬────────┘
                 │
        ┌────────▼─────────┐
        │  Whale Analyzer  │
        │ (Core Logic)     │
        └────────┬─────────┘
                 │
      ┌──────────┼──────────┐
      │          │          │
┌─────▼────┐ ┌──▼───┐ ┌────▼─────┐
│DexScreener│ │Holders│ │Database │
│  (Price/  │ │(Graph/│ │(Railway PostgreSQL)│
│  Volume)  │ │ RPC)  │ │          │
└───────────┘ └───────┘ └──────────┘
                              │
                         ┌────▼────┐
                         │Telegram │
                         │ Reports │
                         └─────────┘
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ with npm
- Railway PostgreSQL account (free tier works)
- Telegram bot token
- Base RPC endpoint (Alchemy/Infura)

### 2. Installation

```bash
# Clone and install dependencies
cd whale-agent
npm install
```

### 3. Database Setup

1. Create a Railway PostgreSQL project at https://railway.app
2. Go to SQL Editor
3. Run the schema in `supabase/schema.sql`

### 4. Telegram Setup

1. Create a bot via [@BotFather](https://t.me/botfather)
   - Send `/newbot`
   - Get your bot token
2. Get your chat ID:
   - Send a message to your bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your `chat.id`

### 5. Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Railway PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Base RPC
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/your_key
BASE_RPC_BACKUP=https://mainnet.base.org

# Tokens (comma-separated)
TOKENS=0x0b3AE50BaBE7FFa4E1A50569ceE6bDEFd4ccAeE0,0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3

# Schedule (every 6 hours)
ANALYSIS_SCHEDULE=0 */6 * * *

# Backfill settings
BACKFILL_DAYS=30
WHALE_THRESHOLD_PERCENTAGE=1.0
```

### 6. Run Initial Backfill

```bash
npm run backfill
```

This creates initial snapshots. Historical data will accumulate as the agent runs.

### 7. Start the Agent

```bash
# Development (with auto-reload)
npm run dev

# Production
npm run build
npm start
```

## 📱 Report Format

Every 6 hours, you'll receive a Telegram report like this:

```markdown
# 🐋 Whale Analysis Report
**Token:** WIRE (0x0b3A...AeE0)
**Generated:** Nov 16, 2025, 3:00 PM UTC
**Risk Score:** 42/100 🟢

## 💰 Price & Volume Analysis
**Current Price:** $0.00123456
**Market Cap:** $1.2M
**Liquidity:** $250K

### Price Changes
- 5m: +2.34% 🚀
- 1h: +5.67%
- 6h: +12.45% 🚀
- 24h: -3.21%

### Volume Breakdown
- 6h: $125K 🔥
- 24h: $280K

### Transaction Activity (6h)
- Buys: 145 transactions
- Sells: 98 transactions
- Buy/Sell Ratio: 1.48 🟢 Buy pressure

## 📈 Chart Health
**Health Score:** 65/100
**Momentum:** 🟢 BULLISH

## 🐋 Whale Activity
**Total Holders:** 15,234

### 📈 Top Accumulators (6h)
- 0xaaaa...bbbb - +15.67% (Rank: 8 → 5)
- 0xcccc...dddd - +12.34% (Rank: 15 → 12)

## 📊 Holder Concentration
**Current Concentration:**
- Top 10: 45.23% 📉
- Top 20: 58.67%
- Top 50: 71.42%

## ⚠️ Risk Analysis
**Overall Risk Score:** 42/100 🟢

### ✅ Positive Indicators
- ✅ Strong whale accumulation detected
- ✅ Concentration decreased >5% in 24h

### 🔔 Active Signals
- accumulation_trend
- high_recent_volume
```

## 🎮 G.A.M.E Integration

### Agent Capabilities

```typescript
// Query the agent
const report = await agent.analyzeToken('WIRE');

// Get status
const status = await agent.getStatus();

// Trigger manual analysis
await agent.triggerAnalysis();

// Add/remove tokens
agent.addToken('0x...', 'TOKEN');
agent.removeToken('TOKEN');
```

### Agent Metadata

```json
{
  "name": "Whale Agent",
  "version": "1.0.0",
  "capabilities": {
    "queries": ["analyzeToken", "getStatus"],
    "actions": ["triggerAnalysis", "addToken", "removeToken"],
    "scheduled": "Every 6 hours"
  }
}
```

## 📁 Project Structure

```
whale-agent/
├── src/
│   ├── services/
│   │   ├── dexscreener.ts      # DexScreener API client
│   │   ├── holders.ts           # The Graph + RPC for holders
│   │   ├── database.ts          # Railway PostgreSQL client
│   │   ├── telegram.ts          # Telegram bot
│   │   └── report-generator.ts  # Markdown formatter
│   ├── analyzer.ts              # Core whale analyzer
│   ├── scheduler.ts             # 6-hour cron scheduler
│   ├── game-agent.ts            # G.A.M.E wrapper
│   ├── index.ts                 # Main entry point
│   └── scripts/
│       └── backfill.ts          # Historical data backfill
├── supabase/
│   └── schema.sql               # Database schema
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔧 Configuration Options

### Cron Schedule

Change `ANALYSIS_SCHEDULE` in `.env`:

```bash
# Every 6 hours (default)
ANALYSIS_SCHEDULE=0 */6 * * *

# Every 3 hours
ANALYSIS_SCHEDULE=0 */3 * * *

# Twice daily (6am, 6pm)
ANALYSIS_SCHEDULE=0 6,18 * * *
```

### Whale Threshold

Adjust what constitutes a "whale" in `.env`:

```bash
# Default: 1% of supply
WHALE_THRESHOLD_PERCENTAGE=1.0

# Stricter: 2% of supply
WHALE_THRESHOLD_PERCENTAGE=2.0
```

## 🐛 Troubleshooting

### "No pairs found for token"
- Token may not be listed on DexScreener yet
- Check if token address is correct
- Ensure token has liquidity on Base

### "The Graph query failed"
- The Graph subgraph may not exist for Base holders
- Agent will automatically fallback to RPC
- Consider integrating Moralis or Alchemy for holder data

### "Telegram message failed"
- Check bot token is correct
- Ensure you've sent a message to your bot first
- Verify chat ID is correct

### "Database connection failed"
- Check Railway PostgreSQL URL and key
- Ensure database schema has been run
- Check Railway PostgreSQL project is active

## 🚀 Production Deployment

### Using PM2

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name whale-agent
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

### Using Systemd

```bash
# Create service file
sudo nano /etc/systemd/system/whale-agent.service

# Add:
[Unit]
Description=Whale Agent
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/whale-agent
ExecStart=/usr/bin/node /path/to/whale-agent/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable whale-agent
sudo systemctl start whale-agent
```

## 📊 Database Queries

### Get latest report
```sql
SELECT * FROM whale_reports
WHERE token_address = '0x...'
ORDER BY report_timestamp DESC
LIMIT 1;
```

### View concentration trends
```sql
SELECT 
  DATE(timestamp) as date,
  AVG(top_10_concentration) as avg_concentration
FROM token_snapshots
WHERE token_address = '0x...'
GROUP BY DATE(timestamp)
ORDER BY date DESC
LIMIT 30;
```

### Top accumulators (last 24h)
```sql
WITH current AS (
  SELECT * FROM whale_positions
  WHERE timestamp >= NOW() - INTERVAL '1 hour'
),
previous AS (
  SELECT * FROM whale_positions
  WHERE timestamp >= NOW() - INTERVAL '25 hours'
    AND timestamp <= NOW() - INTERVAL '23 hours'
)
SELECT 
  c.wallet_address,
  c.balance - p.balance as change
FROM current c
JOIN previous p ON c.wallet_address = p.wallet_address
WHERE c.token_address = '0x...'
ORDER BY change DESC
LIMIT 10;
```

## 🤝 Contributing

Contributions welcome! Feel free to:
- Add new data sources
- Improve risk algorithms
- Add new report formats
- Enhance G.A.M.E integration

## 📄 License

MIT

## 🙏 Acknowledgments

- Virtuals Protocol for G.A.M.E framework
- DexScreener for DEX data
- The Graph for on-chain indexing
- Railway PostgreSQL for database infrastructure

## 📧 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the flowchart and architecture
3. Open an issue on GitHub

---

**Built with ❤️ for Virtuals Protocol**
