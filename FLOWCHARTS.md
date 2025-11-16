# 📊 Whale Agent - Visual Flowcharts

## 🎯 System Overview Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         WHALE AGENT SYSTEM                         │
│                    (Virtuals Protocol G.A.M.E)                     │
└────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
         ┌──────────▼──────────┐      ┌──────────▼───────────┐
         │   ON-DEMAND MODE    │      │   SCHEDULED MODE     │
         │  (User Triggered)   │      │  (Every 6 Hours)     │
         └──────────┬──────────┘      └──────────┬───────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     WHALE ANALYZER          │
                    │   (Core Analysis Engine)    │
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
    ┌───▼───────┐          ┌───────▼────────┐       ┌────────▼────────┐
    │ DexScreener│         │ Holder Data     │       │   Database      │
    │  Client    │         │   Client        │       │   (Supabase)    │
    │            │         │                 │       │                 │
    │ • Price    │         │ • The Graph ───┐│       │ • Store Data    │
    │ • Volume   │         │ • RPC Fallback ││       │ • Retrieve      │
    │ • Liquidity│         │ • Top 50       ││       │ • Trends        │
    └────┬───────┘         └───────┬────────┘│       └────────┬────────┘
         │                         │         │                │
         └─────────────┬───────────┘         │                │
                       │                     │                │
                ┌──────▼──────────┐          │                │
                │ Report Generator │          │                │
                │  (Format Data)   │          │                │
                └──────┬───────────┘          │                │
                       │                      │                │
                ┌──────▼──────────┐           │                │
                │ Telegram Service │           │                │
                │ (Send to User)   │           │                │
                └──────────────────┘           │                │
                                               │                │
                                        ┌──────▼────────┐       │
                                        │   Base RPC    │       │
                                        │ (Blockchain)  │       │
                                        └───────────────┘       │
                                                                │
                                                    ┌───────────▼──────┐
                                                    │ PostgreSQL Tables │
                                                    │ • token_snapshots │
                                                    │ • whale_positions │
                                                    │ • whale_reports   │
                                                    └───────────────────┘
```

---

## 🔄 Complete Analysis Flow

```
START: Scheduled Trigger (00:00, 06:00, 12:00, 18:00)
  │
  ├─► Initialize Iteration
  │   ├─ Token: $WIRE (0x0b3A...AeE0)
  │   └─ Token: $GAME (0x1C4C...63a3)
  │
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        FOR EACH TOKEN                            │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌────────────────────────────────────────────────────────────┐
  │ STEP 1: Fetch Market Data                                  │
  │                                                            │
  │ DexScreener API Call                                       │
  │   GET /latest/dex/tokens/{address}                         │
  │     │                                                      │
  │     ├─► Parse Response                                     │
  │     │   ├─ Price: $0.00123456                             │
  │     │   ├─ Volume 6h: $125,000                            │
  │     │   ├─ Volume 24h: $280,000                           │
  │     │   ├─ Liquidity: $250,000                            │
  │     │   ├─ Buys (6h): 145                                 │
  │     │   ├─ Sells (6h): 98                                 │
  │     │   └─ Buy/Sell Ratio: 1.48                           │
  │     │                                                      │
  │     └─► Store in Database                                  │
  │         INSERT INTO token_snapshots (...)                  │
  │                                                            │
  │ ✅ Market data captured                                    │
  └────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌────────────────────────────────────────────────────────────┐
  │ STEP 2: Fetch Holder Data                                  │
  │                                                            │
  │ Try The Graph First                                        │
  │   GraphQL Query:                                           │
  │   query GetTokenHolders {                                  │
  │     token(id: "0x...") {                                   │
  │       holders(first: 50, orderBy: balance, desc) {         │
  │         address, balance                                   │
  │       }                                                    │
  │     }                                                      │
  │   }                                                        │
  │     │                                                      │
  │     ├─► SUCCESS? ─────────┐                               │
  │     │                      │                               │
  │     │                      ├─► Parse Holders               │
  │     │                      │   ├─ #1: 0xaaaa...bbbb (18.5%)│
  │     │                      │   ├─ #2: 0xcccc...dddd (12.3%)│
  │     │                      │   └─ ... (48 more)            │
  │     │                      │                               │
  │     ├─► FAILED? ──────────┐│                              │
  │                           ││                               │
  │ Fallback to RPC           ││                               │
  │   FOR EACH known wallet:  ││                               │
  │     contract.balanceOf(wallet) ──► Get balance            ││
  │     Calculate percentage         → Sort by balance        ││
  │                                  → Take top 50            ││
  │                                                           ││
  │     └────────────────────────────┘│                       │
  │                                   │                       │
  │     Calculate Concentration       │                       │
  │     ├─ Top 10: 45.23%            │                       │
  │     ├─ Top 20: 58.67%            │                       │
  │     └─ Top 50: 71.42%            │                       │
  │                                   │                       │
  │     Store in Database             │                       │
  │     INSERT INTO whale_positions (...) × 50                │
  │                                                            │
  │ ✅ Holder data captured                                    │
  └────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌────────────────────────────────────────────────────────────┐
  │ STEP 3: Historical Comparison                              │
  │                                                            │
  │ Query Database for 6h Old Snapshot                         │
  │   SELECT * FROM whale_positions                            │
  │   WHERE timestamp >= NOW() - INTERVAL '6 hours'            │
  │     │                                                      │
  │     ├─► Compare Each Wallet                               │
  │     │   │                                                  │
  │     │   ├─ NEW WHALES (not in old list)                   │
  │     │   │   └─ 0x1234...5678 entered at rank #23          │
  │     │   │                                                  │
  │     │   ├─ EXITED WHALES (not in new list)                │
  │     │   │   └─ 0x9876...5432 exited from rank #38         │
  │     │   │                                                  │
  │     │   ├─ ACCUMULATORS (balance increased >1%)           │
  │     │   │   ├─ 0xaaaa...bbbb: +15.67% (Rank 8→5)          │
  │     │   │   ├─ 0xcccc...dddd: +12.34% (Rank 15→12)        │
  │     │   │   └─ 0xeeee...ffff: +8.92% (Rank 22→18)         │
  │     │   │                                                  │
  │     │   └─ DISTRIBUTORS (balance decreased >1%)           │
  │     │       ├─ 0x9999...8888: -18.34% (Rank 3→7)          │
  │     │       └─ 0x7777...6666: -10.12% (Rank 12→16)        │
  │     │                                                      │
  │     └─► Calculate Net Flow                                 │
  │         (Accumulation - Distribution) × Price              │
  │         = Net Whale Flow USD                               │
  │                                                            │
  │ ✅ Changes detected and quantified                         │
  └────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌────────────────────────────────────────────────────────────┐
  │ STEP 4: Trend Analysis                                     │
  │                                                            │
  │ Query Historical Snapshots                                 │
  │   SELECT top_10_concentration, timestamp                   │
  │   FROM token_snapshots                                     │
  │   WHERE token_address = '0x...'                            │
  │   ORDER BY timestamp DESC                                  │
  │   LIMIT 336  -- 7 days of 30-min snapshots                │
  │     │                                                      │
  │     ├─► Calculate Concentration Changes                    │
  │     │   ├─ 6h ago:  42.89% → Now: 45.23% = +2.34%        │
  │     │   ├─ 24h ago: 49.35% → Now: 45.23% = -4.12%        │
  │     │   └─ 7d ago:  44.00% → Now: 45.23% = +1.23%        │
  │     │                                                      │
  │     └─► Analyze Chart Health                              │
  │         ├─ Price Momentum: +12.45% (6h) → BULLISH         │
  │         ├─ Volume Ratio: 44.6% in last 6h → HIGH          │
  │         ├─ Buy Pressure: 1.48 ratio → POSITIVE            │
  │         └─ Health Score: 65/100                           │
  │                                                            │
  │ ✅ Trends identified                                       │
  └────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌────────────────────────────────────────────────────────────┐
  │ STEP 5: Risk Assessment                                    │
  │                                                            │
  │ Initialize Risk Score: 50 (baseline)                       │
  │   │                                                        │
  │   ├─► Check Concentration                                 │
  │   │   Top 10 = 45.23%                                     │
  │   │   └─ Between 40-60% → Moderate (no change)           │
  │   │                                                        │
  │   ├─► Check Largest Holder                                │
  │   │   18.5% < 20% threshold                               │
  │   │   └─ Acceptable (no penalty)                          │
  │   │                                                        │
  │   ├─► Check Whale Behavior                                │
  │   │   5 Accumulators vs 2 Distributors                    │
  │   │   └─ Strong accumulation: -15 risk points             │
  │   │                                                        │
  │   ├─► Check Concentration Trend                           │
  │   │   24h change: -4.12% (improving)                      │
  │   │   └─ Good sign: -10 risk points                       │
  │   │                                                        │
  │   ├─► Check Chart Health                                  │
  │   │   Bullish momentum detected                           │
  │   │   └─ Positive: -10 risk points                        │
  │   │                                                        │
  │   ├─► Check Liquidity                                     │
  │   │   $250K > $50K threshold                              │
  │   │   └─ Safe: no penalty                                 │
  │   │                                                        │
  │   └─► Final Risk Score                                    │
  │       50 - 15 - 10 - 10 = 15                              │
  │       Clamped to: 15/100 🟢 LOW RISK                      │
  │                                                            │
  │ Generate Signals:                                          │
  │   ├─ ✅ "Strong whale accumulation detected"              │
  │   ├─ ✅ "Concentration improving over 24h"                │
  │   ├─ ✅ "Bullish chart momentum"                          │
  │   └─ 🔔 "accumulation_trend"                              │
  │                                                            │
  │ ✅ Risk analysis complete                                  │
  └────────────────────────────────────────────────────────────┘
  │
  ▼
  ┌────────────────────────────────────────────────────────────┐
  │ STEP 6: Report Generation                                  │
  │                                                            │
  │ Assemble Report Data:                                      │
  │   ├─ Token info (address, symbol)                         │
  │   ├─ Market metrics (price, volume, liquidity)            │
  │   ├─ Whale positions (current + changes)                  │
  │   ├─ Trends (6h, 24h, 7d)                                 │
  │   ├─ Risk assessment (score, signals, concerns)           │
  │   └─ Notable wallets (largest, biggest movements)         │
  │     │                                                      │
  │     ├─► Format as Markdown                                │
  │     │   │                                                  │
  │     │   ├─ Header (title, timestamp, risk score)          │
  │     │   ├─ Price & Volume section                         │
  │     │   ├─ Chart Health section                           │
  │     │   ├─ Whale Activity section                         │
  │     │   ├─ Concentration section                          │
  │     │   ├─ Risk Analysis section                          │
  │     │   ├─ Notable Wallets section                        │
  │     │   └─ Footer                                          │
  │     │                                                      │
  │     ├─► Store Report in Database                          │
  │     │   INSERT INTO whale_reports (                        │
  │     │     token_address, timestamp,                        │
  │     │     metrics, report_json, report_markdown            │
  │     │   )                                                  │
  │     │                                                      │
  │     └─► Send to Telegram                                  │
  │         ├─ Split if > 4096 characters                     │
  │         ├─ Send each chunk with 500ms delay               │
  │         └─ Mark as sent in database                       │
  │                                                            │
  │ ✅ Report delivered!                                       │
  └────────────────────────────────────────────────────────────┘
  │
  ▼
  Wait 2 seconds (rate limit protection)
  │
  ▼
  Next Token → Repeat from STEP 1
  │
  ▼
COMPLETE: All Tokens Analyzed
  │
  ├─► Log Summary
  │   "✅ BATCH COMPLETE - 2025-11-16T18:00:00Z"
  │   "⏰ Next run: Nov 17, 2025, 12:00 AM"
  │
  └─► Wait for Next Schedule (in 6 hours)
```

---

## 🎮 G.A.M.E Agent Query Flow

```
USER QUERY: "Analyze $WIRE now"
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ G.A.M.E Agent (game-agent.ts)                               │
│   Receives query through Virtuals Protocol interface        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─► Parse Request
                 │   ├─ Extract token: "WIRE"
                 │   └─ Map to address: 0x0b3A...AeE0
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Analyzer (analyzer.ts)                                       │
│   Run immediate analysis (bypass scheduler)                 │
│     │                                                        │
│     ├─► Execute Steps 1-6 (same as scheduled flow)          │
│     │   └─ Skip Telegram delivery (query response only)     │
│     │                                                        │
│     └─► Return Results                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Format Response                                              │
│   {                                                          │
│     "success": true,                                         │
│     "token": "WIRE",                                         │
│     "report": {                                              │
│       "timestamp": "2025-11-16T18:30:00Z",                   │
│       "riskScore": 15,                                       │
│       "price": 0.00123456,                                   │
│       "priceChange6h": 12.45,                                │
│       "concentration": { "top10": 45.23, ... },              │
│       "whaleActivity": { "accumulating": 5, ... },           │
│       "signals": ["accumulation_trend"],                     │
│       "concerns": [],                                        │
│       "positiveIndicators": ["Strong accumulation"]          │
│     },                                                       │
│     "markdown": "# 🐋 Whale Analysis Report..."              │
│   }                                                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
Return to User in 10-30 seconds
```

---

## 🗄️ Database Schema Flow

```
┌────────────────────────────────────────────────────────────┐
│                    DATA STORAGE FLOW                        │
└────────────────────────────────────────────────────────────┘

STEP 1 Output → token_snapshots
  ├─ Frequency: Every 30 minutes (continuous)
  ├─ Purpose: Price/volume history for trends
  └─ Retention: 30 days raw, then daily aggregates

STEP 2 Output → whale_positions
  ├─ Frequency: Every 6 hours (with analysis)
  ├─ Purpose: Track individual whale holdings
  └─ Retention: 30 days

STEP 3 Output → (comparison only, no storage)
  └─ Derived from whale_positions queries

STEP 6 Output → whale_reports
  ├─ Frequency: Every 6 hours
  ├─ Purpose: Complete analysis snapshots
  └─ Retention: Forever (compact summaries)

Future: whale_transactions
  ├─ Frequency: Real-time (when detected)
  ├─ Purpose: Large transfers >1% supply
  └─ Retention: Forever (rare events)
```

---

## 📈 Data Lifecycle

```
DAY 0 (Launch)
  └─► Backfill: Create initial snapshot

DAY 1-7 (Building History)
  ├─► Every 30 min: Store market snapshot
  ├─► Every 6 hours: Store whale positions + send report
  └─► Trends start becoming meaningful after 24h

DAY 8-30 (Full Operation)
  ├─► Complete 30-day trend data available
  ├─► All risk signals fully functional
  └─► Pattern recognition at peak accuracy

DAY 31+ (Maintenance Mode)
  ├─► Old snapshots aggregated to daily summaries
  ├─► Database size stabilizes
  └─► Continuous operation

```

---

**Legend:**
- 🔵 Data fetch operation
- 🟢 Success path
- 🔴 Error/fallback path
- 💾 Database write
- 📤 External API call
- ⚙️ Internal processing
