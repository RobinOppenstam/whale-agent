# 🏗️ Whale Agent - Architecture & Overview

## 📋 Table of Contents
1. [High-Level Overview](#high-level-overview)
2. [System Flow](#system-flow)
3. [Component Breakdown](#component-breakdown)
4. [Data Flow](#data-flow)
5. [File Responsibilities](#file-responsibilities)
6. [Integration Points](#integration-points)

---

## 🎯 High-Level Overview

The Whale Agent is an autonomous AI system built on the Virtuals Protocol (G.A.M.E) framework that monitors and analyzes whale activity for cryptocurrency tokens on the Base blockchain.

### Core Capabilities

```
┌─────────────────────────────────────────────────────────────┐
│                    WHALE AGENT SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 AUTOMATED ANALYSIS (Every 6 Hours)                      │
│    ├─ Fetch price, volume, liquidity (DexScreener)        │
│    ├─ Track top 50 holder positions (The Graph/RPC)        │
│    ├─ Detect accumulation/distribution patterns            │
│    ├─ Calculate risk scores and concentration metrics      │
│    └─ Send comprehensive report to Telegram                │
│                                                             │
│  🔍 ON-DEMAND QUERIES (G.A.M.E Interface)                   │
│    ├─ Analyze specific token immediately                   │
│    ├─ Get current status of tracked tokens                 │
│    ├─ Retrieve historical reports                          │
│    └─ Query whale positions and changes                    │
│                                                             │
│  💾 HISTORICAL TRACKING (30-Day Trends)                     │
│    ├─ Store snapshots every 30 minutes                     │
│    ├─ Track concentration changes over time                │
│    ├─ Build whale behavior patterns                        │
│    └─ Enable trend-based predictions                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 System Flow

### 1. Initialization Flow

```
START
  │
  ├─► Load environment variables (.env)
  │
  ├─► Initialize Services
  │   ├─► DexScreener Client (price/volume data)
  │   ├─► Holder Data Client (whale positions)
  │   ├─► Database Service (Supabase)
  │   └─► Telegram Service (report delivery)
  │
  ├─► Test Connections
  │   ├─► Ping Telegram bot
  │   └─► Verify Supabase access
  │
  ├─► Setup Scheduler
  │   ├─► Configure cron (every 6 hours)
  │   └─► Run initial analysis immediately
  │
  └─► READY ✅
```

### 2. Analysis Flow (Runs Every 6 Hours)

```
SCHEDULED TRIGGER (0, 6, 12, 18:00)
  │
  ├─► FOR EACH TOKEN ($WIRE, $GAME):
  │     │
  │     ├─► STEP 1: Fetch DexScreener Data
  │     │   ├─ Price (current, 5m, 1h, 6h, 24h changes)
  │     │   ├─ Volume (5m, 1h, 6h, 24h)
  │     │   ├─ Liquidity (USD value)
  │     │   ├─ Transaction counts (buys/sells)
  │     │   └─ Store in database ✓
  │     │
  │     ├─► STEP 2: Fetch Holder Data
  │     │   ├─ Try The Graph query first
  │     │   ├─ Fallback to RPC if Graph fails
  │     │   ├─ Get top 50 wallets
  │     │   ├─ Calculate balances & percentages
  │     │   └─ Store positions in database ✓
  │     │
  │     ├─► STEP 3: Historical Comparison
  │     │   ├─ Query snapshot from 6 hours ago
  │     │   ├─ Detect new whales (entered top 50)
  │     │   ├─ Detect exited whales (left top 50)
  │     │   ├─ Identify accumulators (+balance)
  │     │   └─ Identify distributors (-balance)
  │     │
  │     ├─► STEP 4: Trend Analysis
  │     │   ├─ Calculate concentration changes
  │     │   │  ├─ 6 hour trend
  │     │   │  ├─ 24 hour trend
  │     │   │  └─ 7 day trend
  │     │   └─ Analyze chart health
  │     │      ├─ Price momentum
  │     │      ├─ Volume patterns
  │     │      └─ Buy/sell pressure
  │     │
  │     ├─► STEP 5: Risk Assessment
  │     │   ├─ Calculate risk score (0-100)
  │     │   ├─ Identify concerns (red flags)
  │     │   ├─ Identify positive signals
  │     │   └─ Generate active signals
  │     │
  │     ├─► STEP 6: Report Generation
  │     │   ├─ Build report data structure
  │     │   ├─ Generate markdown format
  │     │   ├─ Store report in database ✓
  │     │   └─ Send to Telegram ✓
  │     │
  │     └─► Wait 2 seconds (rate limit protection)
  │
  └─► COMPLETE
       ├─► Log summary
       └─► Schedule next run (in 6 hours)
```

### 3. On-Demand Query Flow (G.A.M.E Interface)

```
USER QUERY: "Analyze $WIRE"
  │
  ├─► Parse request (identify token)
  │
  ├─► Run immediate analysis
  │   ├─ Follow steps 1-6 from scheduled flow
  │   └─ Skip Telegram notification (query only)
  │
  ├─► Format response
  │   ├─ JSON structure with key metrics
  │   ├─ Markdown report text
  │   └─ Risk assessment summary
  │
  └─► Return to user
```

---

## 🧩 Component Breakdown

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                  COMPONENT ARCHITECTURE                     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 1. G.A.M.E AGENT (game-agent.ts)                            │
│    Purpose: Virtuals Protocol wrapper & interface            │
│    ├─ Exposes queries (analyzeToken, getStatus)             │
│    ├─ Exposes actions (triggerAnalysis, addToken)           │
│    └─ Manages agent lifecycle                               │
└──────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
┌───────────────────▼──────┐  ┌────────▼──────────────────────┐
│ 2. ANALYZER              │  │ 3. SCHEDULER                  │
│    (analyzer.ts)         │  │    (scheduler.ts)              │
│                          │  │                                │
│ Purpose: Core logic      │  │ Purpose: Automated runs        │
│ ├─ Orchestrates services │  │ ├─ Cron job management        │
│ ├─ Runs analysis steps   │  │ ├─ Token iteration            │
│ ├─ Risk calculation      │  │ └─ Manual triggers            │
│ └─ Report assembly       │  │                                │
└──────────────────────────┘  └────────────────────────────────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───▼───┐ ┌─▼──┐ ┌───▼────┐
│4.DEXS │ │5.HLD│ │6.DB    │
│CREENER│ │DATA │ │SERVICE │
└───────┘ └────┘ └────────┘

┌──────────────────────────────────────────────────────────────┐
│ 4. DEXSCREENER CLIENT (dexscreener.ts)                       │
│    Purpose: Fetch price, volume, liquidity data              │
│    ├─ Queries DexScreener API                               │
│    ├─ Parses pair data                                      │
│    ├─ Calculates chart health                              │
│    └─ Returns TokenMetrics object                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 5. HOLDER DATA CLIENT (holders.ts)                           │
│    Purpose: Fetch top holder positions                       │
│    ├─ Primary: The Graph GraphQL queries                    │
│    ├─ Fallback: Direct RPC calls (ethers.js)               │
│    ├─ Calculates concentration metrics                     │
│    └─ Returns HolderSnapshot object                        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 6. DATABASE SERVICE (database.ts)                            │
│    Purpose: Persist and retrieve data                        │
│    ├─ Supabase client wrapper                              │
│    ├─ CRUD operations for all tables                       │
│    ├─ Historical queries (trends, comparisons)              │
│    └─ Report storage & retrieval                           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 7. REPORT GENERATOR (report-generator.ts)                    │
│    Purpose: Format data into markdown reports                │
│    ├─ Takes ReportData input                                │
│    ├─ Generates sections (price, whales, risk)              │
│    ├─ Applies formatting (emojis, arrows, colors)           │
│    └─ Returns formatted markdown string                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 8. TELEGRAM SERVICE (telegram.ts)                            │
│    Purpose: Deliver reports to user                          │
│    ├─ Sends markdown messages                               │
│    ├─ Handles message splitting (4096 char limit)           │
│    ├─ Sends alerts for errors                              │
│    └─ Connection testing                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### Data Structure Journey

```
1. RAW DATA (External APIs)
   │
   ├─► DexScreener Response
   │   {
   │     priceUsd: "0.00123456",
   │     volume: { h6: 125000, h24: 280000 },
   │     txns: { h6: { buys: 145, sells: 98 } }
   │   }
   │
   └─► The Graph Response
       {
         holders: [
           { address: "0x...", balance: "1000000" },
           ...
         ]
       }
   │
   ▼
2. NORMALIZED DATA (Service Layer)
   │
   ├─► TokenMetrics
   │   {
   │     priceUsd: number,
   │     volume6h: number,
   │     buySellRatio6h: number,
   │     ...
   │   }
   │
   └─► HolderSnapshot
       {
         topHolders: HolderData[],
         top10Concentration: number,
         top20Concentration: number,
         ...
       }
   │
   ▼
3. STORED DATA (Supabase)
   │
   ├─► token_snapshots table
   │   (every 30 min, enables trends)
   │
   ├─► whale_positions table
   │   (every 6 hours, tracks changes)
   │
   └─► whale_reports table
       (every 6 hours, full analysis)
   │
   ▼
4. ANALYZED DATA (Analyzer)
   │
   └─► ReportData
       {
         metrics: TokenMetrics,
         currentSnapshot: HolderSnapshot,
         accumulators: [...],
         distributors: [...],
         riskScore: number,
         signals: [...],
         ...
       }
   │
   ▼
5. FORMATTED REPORT (Report Generator)
   │
   └─► Markdown String
       "# 🐋 Whale Analysis Report
        **Token:** WIRE
        **Risk Score:** 42/100
        ..."
   │
   ▼
6. DELIVERED (Telegram)
   │
   └─► User's Telegram Chat
```

---

## 📁 File Responsibilities

### `/src` Directory

| File | Role | Key Functions | Dependencies |
|------|------|---------------|--------------|
| **index.ts** | Entry point | - Parse config<br>- Initialize agent<br>- Handle shutdown | game-agent.ts |
| **game-agent.ts** | G.A.M.E wrapper | - Agent interface<br>- Query handlers<br>- Action handlers | analyzer.ts, scheduler.ts |
| **analyzer.ts** | Core logic | - orchestrate analysis<br>- Risk calculation<br>- Report assembly | All services |
| **scheduler.ts** | Automation | - Cron management<br>- Batch processing<br>- Manual triggers | analyzer.ts |

### `/src/services` Directory

| File | Role | External APIs | Output |
|------|------|---------------|--------|
| **dexscreener.ts** | Price/volume | DexScreener API | TokenMetrics |
| **holders.ts** | Whale tracking | The Graph, Base RPC | HolderSnapshot |
| **database.ts** | Persistence | Supabase | CRUD operations |
| **report-generator.ts** | Formatting | None (pure logic) | Markdown string |
| **telegram.ts** | Delivery | Telegram Bot API | Message sending |

### `/supabase` Directory

| File | Purpose |
|------|---------|
| **schema.sql** | - Database schema<br>- Tables, indexes, functions<br>- Run once during setup |

### Root Files

| File | Purpose |
|------|---------|
| **package.json** | Dependencies & scripts |
| **tsconfig.json** | TypeScript configuration |
| **.env.example** | Configuration template |
| **README.md** | User documentation |
| **ARCHITECTURE.md** | This file - technical docs |

---

## 🔗 Integration Points

### External Services

```
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS                     │
└─────────────────────────────────────────────────────────────┘

1. DEXSCREENER API
   Endpoint: https://api.dexscreener.com/latest/dex/tokens/{address}
   Purpose: Real-time price, volume, liquidity data
   Rate Limit: Generous (no key required)
   Fallback: None (critical dependency)

2. THE GRAPH
   Endpoint: https://api.thegraph.com/subgraphs/name/...
   Purpose: Historical holder data via GraphQL
   Rate Limit: 1000 queries/day (free)
   Fallback: Direct RPC calls

3. BASE RPC (Alchemy/Infura)
   Endpoint: https://base-mainnet.g.alchemy.com/v2/{key}
   Purpose: Direct blockchain queries (holder balances)
   Rate Limit: 300M compute units/month (free tier)
   Fallback: Public RPC (https://mainnet.base.org)

4. SUPABASE
   Endpoint: https://{project}.supabase.co
   Purpose: PostgreSQL database, REST API
   Rate Limit: 500MB database, 50K rows (free tier)
   Fallback: None (critical dependency)

5. TELEGRAM BOT API
   Endpoint: https://api.telegram.org/bot{token}/...
   Purpose: Message delivery to user
   Rate Limit: 30 messages/second per chat
   Fallback: Logs to console if delivery fails
```

### Database Schema

```sql
Tables:
  ├─ token_snapshots      (30-min price/volume data)
  ├─ whale_positions      (6-hour holder positions)
  ├─ whale_transactions   (large transfers >1% supply)
  └─ whale_reports        (6-hour analysis reports)

Relationships:
  token_snapshots.token_address ──┐
  whale_positions.token_address ──┼─► Primary key for queries
  whale_reports.token_address   ──┘

Indexes:
  - (token_address, timestamp DESC) on all tables
  - (wallet_address) on whale_positions
  - (telegram_sent) on whale_reports
```

### Data Sources Priority

```
HOLDER DATA:
  1st Choice: The Graph (fast, indexed)
     ↓ (if fails)
  2nd Choice: RPC Calls (slow but reliable)
     ↓ (if fails)
  3rd Choice: Skip holder analysis, report error

PRICE DATA:
  1st Choice: DexScreener (only option)
     ↓ (if fails)
  Critical Error: Cannot proceed without price data
```

---

## 🎯 Key Design Decisions

### 1. Why 6-Hour Intervals?
- Balance between data freshness and API rate limits
- Captures meaningful whale movements
- Allows time for on-chain confirmations
- Reduces noise from short-term volatility

### 2. Why Supabase?
- Built-in PostgreSQL with time-series support
- Easy REST API for queries
- Generous free tier (perfect for MVP)
- Can scale to paid tiers seamlessly
- Real-time subscriptions (future feature)

### 3. Why The Graph + RPC Fallback?
- The Graph: Fast queries, indexed data
- RPC: Always available, no rate limits on public nodes
- Hybrid approach ensures reliability

### 4. Why DexScreener?
- No API key required
- Covers all major DEXes on Base
- Includes transaction counts (buy/sell)
- Free and reliable

### 5. Why Telegram?
- Simple, instant notifications
- No need for custom UI/frontend
- User already has Telegram
- Supports markdown formatting
- Easy to set up (just need bot token)

---

## 🚀 Scaling Considerations

### Current Limitations
- **Tokens**: 2 tracked tokens ($WIRE, $GAME)
- **Frequency**: 6-hour intervals
- **Holders**: Top 50 tracked
- **History**: 30 days in database

### Scale-Up Path

```
PHASE 1 (Current MVP)
  ├─ 2 tokens
  ├─ 6-hour reports
  ├─ Personal Telegram
  └─ Free tier infrastructure

PHASE 2 (10-100 tokens)
  ├─ Add Moralis/Alchemy for holders
  ├─ Increase to 3-hour intervals
  ├─ Add Discord/Twitter delivery
  └─ Upgrade to Supabase Pro

PHASE 3 (100+ tokens)
  ├─ Distributed architecture (queue system)
  ├─ Real-time websocket updates
  ├─ Machine learning predictions
  ├─ Public API for users
  └─ Dedicated infrastructure

PHASE 4 (Enterprise)
  ├─ Multi-chain support
  ├─ Custom subgraph deployment
  ├─ Advanced pattern recognition
  └─ Dedicated servers
```

---

## 🔍 Monitoring & Debugging

### Logs to Monitor

```typescript
// Successful analysis
"✅ Analysis complete for WIRE"
"   Risk Score: 42/100"
"   Top 10 Concentration: 45.23%"

// Errors to watch for
"❌ Failed to fetch data from DexScreener"
"⚠️  The Graph query failed, falling back to RPC"
"❌ Error storing whale positions"

// Performance metrics
"📊 Fetching price and volume data from DexScreener... [2.3s]"
"🐋 Fetching top 50 holder data... [5.1s]"
"💾 Storing report in database... [0.8s]"
```

### Health Checks

```bash
# Check if agent is running
ps aux | grep "node.*index.js"

# Check recent logs
tail -f logs/whale-agent.log

# Check database connection
curl -X POST https://your-project.supabase.co/rest/v1/rpc/get_latest_snapshot

# Check Telegram delivery
# Should see messages in your chat every 6 hours
```

---

## 📖 Summary

This Whale Agent is a **production-ready, autonomous AI system** that:

1. ✅ Monitors whale activity 24/7
2. ✅ Analyzes price, volume, and holder data
3. ✅ Generates comprehensive risk assessments
4. ✅ Delivers reports via Telegram automatically
5. ✅ Exposes G.A.M.E interface for on-demand queries
6. ✅ Stores 30 days of historical data for trends
7. ✅ Scales from 2 to 100+ tokens

**Built on proven technologies:**
- TypeScript for type safety
- Supabase for reliable storage
- DexScreener for market data
- The Graph for blockchain indexing
- Telegram for instant delivery
- Virtuals Protocol (G.A.M.E) for AI agent framework

**Ready to deploy and extend!** 🚀
