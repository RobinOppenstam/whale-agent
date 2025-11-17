import { TokenMetrics, DexScreenerClient } from './dexscreener.js';
import { HolderSnapshot, HolderData, WhaleTransaction } from './holders.js';

export interface ReportData {
  tokenAddress: string;
  tokenSymbol: string;
  timestamp: Date;

  // Price & Volume
  metrics: TokenMetrics;
  chartHealth: ReturnType<typeof DexScreenerClient.analyzeChartHealth>;

  // Whale data
  currentSnapshot: HolderSnapshot;
  previousSnapshot?: HolderSnapshot;
  whaleTransactions?: WhaleTransaction[];

  // Changes
  newWhales: HolderData[];
  exitedWhales: HolderData[];
  accumulators: Array<{
    address: string;
    oldRank: number;
    newRank: number;
    balanceChange: number;
    percentageChange: number;
  }>;
  distributors: Array<{
    address: string;
    oldRank: number;
    newRank: number;
    balanceChange: number;
    percentageChange: number;
  }>;
  
  // Trends
  concentrationChange6h: number;
  concentrationChange24h: number;
  concentrationChange7d: number;
  
  // Risk
  riskScore: number;
  signals: string[];
  concerns: string[];
  positiveIndicators: string[];
}

export class ReportGenerator {
  /**
   * Generate comprehensive markdown report
   */
  static generateMarkdown(data: ReportData): string {
    const sections = [
      this.generateHeader(data),
      this.generatePriceVolume(data),
      this.generateChartHealth(data),
      this.generateWhaleActivity(data),
      this.generateConcentration(data),
      this.generateRiskAnalysis(data),
      this.generateNotableWallets(data),
      this.generateFooter()
    ];
    
    return sections.join('\n\n');
  }
  
  /**
   * Generate report header
   */
  private static generateHeader(data: ReportData): string {
    const timestamp = data.timestamp.toLocaleString('en-US', {
      timeZone: 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    
    return `# 🐋 Whale Analysis Report
**Token:** ${data.tokenSymbol} (\`${this.shortenAddress(data.tokenAddress)}\`)
**Generated:** ${timestamp} UTC
**Risk Score:** ${data.riskScore}/100 ${this.getRiskEmoji(data.riskScore)}

---`;
  }
  
  /**
   * Generate price and volume section
   */
  private static generatePriceVolume(data: ReportData): string {
    const m = data.metrics;
    
    return `## 💰 Price & Volume Analysis

**Current Price:** $${this.formatNumber(m.priceUsd, 8)}
**Market Cap:** $${this.formatNumber(m.marketCap, 2)}
**Liquidity:** $${this.formatNumber(m.liquidityUsd, 2)}

### Price Changes
- **5m:** ${this.formatPercentage(m.priceChange5m)}
- **1h:** ${this.formatPercentage(m.priceChange1h)}
- **6h:** ${this.formatPercentage(m.priceChange6h)}
- **24h:** ${this.formatPercentage(m.priceChange24h)}

### Volume Breakdown
- **5m:** $${this.formatNumber(m.volume5m, 2)}
- **1h:** $${this.formatNumber(m.volume1h, 2)}
- **6h:** $${this.formatNumber(m.volume6h, 2)} ${this.volumeIndicator(m.volume6h, m.volume24h)}
- **24h:** $${this.formatNumber(m.volume24h, 2)}

### Transaction Activity (6h)
- **Buys:** ${m.txns6hBuys} transactions
- **Sells:** ${m.txns6hSells} transactions
- **Buy/Sell Ratio:** ${this.formatRatio(m.txns6hBuys, m.txns6hSells)} ${this.pressureIndicator(m.txns6hBuys, m.txns6hSells)}`;
  }
  
  /**
   * Generate chart health section
   */
  private static generateChartHealth(data: ReportData): string {
    const health = data.chartHealth;
    
    return `## 📈 Chart Health

**Health Score:** ${health.score}/100
**Momentum:** ${this.getMomentumEmoji(health.momentum)} ${health.momentum.toUpperCase()}

### Signals
${health.signals.length > 0 
  ? health.signals.map(s => `- 🔔 ${s}`).join('\n')
  : '- No significant signals detected'
}`;
  }
  
  /**
   * Generate whale activity section
   */
  private static generateWhaleActivity(data: ReportData): string {
    let section = `## 🐋 Whale Activity (Top 50 Holders)

**Total Holders:** ${data.currentSnapshot.totalHolders.toLocaleString()}`;
    
    // New whales
    if (data.newWhales.length > 0) {
      section += `\n\n### 🆕 New Whales (Entered Top 50)
${data.newWhales.map(w => 
  `- **#${w.rank}** \`${this.shortenAddress(w.address)}\` - ${w.percentageOfSupply.toFixed(2)}% of supply`
).join('\n')}`;
    }
    
    // Exited whales
    if (data.exitedWhales.length > 0) {
      section += `\n\n### 🚪 Exited Whales
${data.exitedWhales.map(w =>
  `- **#${w.rank}** \`${this.shortenAddress(w.address)}\` - Previously held ${w.percentageOfSupply.toFixed(2)}%`
).join('\n')}`;
    }
    
    // Top accumulators
    if (data.accumulators.length > 0) {
      section += `\n\n### 📈 Top Accumulators (6h)
${data.accumulators.slice(0, 5).map(a =>
  `- \`${this.shortenAddress(a.address)}\` - **+${a.percentageChange.toFixed(2)}%** (Rank: ${a.oldRank} → ${a.newRank})`
).join('\n')}`;
    } else {
      section += `\n\n### 📈 Top Accumulators (6h)
- No significant accumulation detected`;
    }
    
    // Top distributors
    if (data.distributors.length > 0) {
      section += `\n\n### 📉 Top Distributors (6h)
${data.distributors.slice(0, 5).map(d =>
  `- \`${this.shortenAddress(d.address)}\` - **${d.percentageChange.toFixed(2)}%** (Rank: ${d.oldRank} → ${d.newRank})`
).join('\n')}`;
    } else {
      section += `\n\n### 📉 Top Distributors (6h)
- No significant distribution detected`;
    }

    // Large whale transactions
    if (data.whaleTransactions && data.whaleTransactions.length > 0) {
      section += `\n\n### 💸 Large Transactions (>1% of supply)
${data.whaleTransactions.slice(0, 10).map(tx => {
  const typeEmoji = tx.type === 'buy' ? '🟢' : tx.type === 'sell' ? '🔴' : '🔄';
  const timestamp = tx.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `- ${typeEmoji} **${tx.type.toUpperCase()}** - ${tx.percentageOfSupply.toFixed(2)}% (${tx.valueFormatted.toLocaleString()} tokens) at ${timestamp}
  \`${this.shortenAddress(tx.transactionHash)}\``;
}).join('\n')}`;
    }

    return section;
  }
  
  /**
   * Generate concentration section
   */
  private static generateConcentration(data: ReportData): string {
    return `## 📊 Holder Concentration

**Current Concentration:**
- **Top 10:** ${data.currentSnapshot.top10Concentration.toFixed(2)}% ${this.trendArrow(data.concentrationChange6h)}
- **Top 20:** ${data.currentSnapshot.top20Concentration.toFixed(2)}%
- **Top 50:** ${data.currentSnapshot.top50Concentration.toFixed(2)}%

**Concentration Changes:**
- **6h:** ${this.formatChange(data.concentrationChange6h)}
- **24h:** ${this.formatChange(data.concentrationChange24h)}
- **7d:** ${this.formatChange(data.concentrationChange7d)}

${this.getConcentrationAssessment(data.currentSnapshot.top10Concentration)}`;
  }
  
  /**
   * Generate risk analysis section
   */
  private static generateRiskAnalysis(data: ReportData): string {
    let section = `## ⚠️ Risk Analysis

**Overall Risk Score:** ${data.riskScore}/100 ${this.getRiskEmoji(data.riskScore)}`;
    
    if (data.concerns.length > 0) {
      section += `\n\n### 🚨 Concerns
${data.concerns.map(c => `- ⚠️ ${c}`).join('\n')}`;
    }
    
    if (data.positiveIndicators.length > 0) {
      section += `\n\n### ✅ Positive Indicators
${data.positiveIndicators.map(p => `- ✅ ${p}`).join('\n')}`;
    }
    
    if (data.signals.length > 0) {
      section += `\n\n### 🔔 Active Signals
${data.signals.map(s => `- \`${s}\``).join('\n')}`;
    }
    
    return section;
  }
  
  /**
   * Generate notable wallets section
   */
  private static generateNotableWallets(data: ReportData): string {
    const largest = data.currentSnapshot.topHolders[0];
    const biggestAcc = data.accumulators[0];
    const biggestDist = data.distributors[0];
    const newest = data.newWhales[0];
    
    let section = `## 🎯 Notable Wallets`;
    
    if (largest) {
      section += `\n\n**Largest Holder:**
- Address: \`${this.shortenAddress(largest.address)}\`
- Holding: ${largest.percentageOfSupply.toFixed(2)}% of supply
- Value: $${this.formatNumber(largest.balanceFormatted * data.metrics.priceUsd, 2)}`;
    }
    
    if (biggestAcc) {
      section += `\n\n**Biggest Accumulator (6h):**
- Address: \`${this.shortenAddress(biggestAcc.address)}\`
- Change: +${biggestAcc.percentageChange.toFixed(2)}%
- Rank movement: ${biggestAcc.oldRank} → ${biggestAcc.newRank}`;
    }
    
    if (biggestDist) {
      section += `\n\n**Biggest Distributor (6h):**
- Address: \`${this.shortenAddress(biggestDist.address)}\`
- Change: ${biggestDist.percentageChange.toFixed(2)}%
- Rank movement: ${biggestDist.oldRank} → ${biggestDist.newRank}`;
    }
    
    if (newest) {
      section += `\n\n**Newest Whale:**
- Address: \`${this.shortenAddress(newest.address)}\`
- Rank: #${newest.rank}
- Holding: ${newest.percentageOfSupply.toFixed(2)}% of supply`;
    }
    
    return section;
  }
  
  /**
   * Generate footer
   */
  private static generateFooter(): string {
    return `---

*🤖 Report generated by Whale Agent v1.0*
*Powered by Virtuals Protocol (G.A.M.E)*
*Data sources: DexScreener, The Graph, Base RPC*`;
  }
  
  // Helper methods
  
  private static shortenAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  
  private static formatNumber(num: number, decimals: number = 2): string {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(decimals);
  }
  
  private static formatPercentage(num: number): string {
    const sign = num >= 0 ? '+' : '';
    const emoji = num > 5 ? '🚀' : num < -5 ? '📉' : '';
    return `${sign}${num.toFixed(2)}% ${emoji}`;
  }
  
  private static formatChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }
  
  private static formatRatio(buys: number, sells: number): string {
    if (sells === 0) return `${buys.toFixed(2)}`;
    return (buys / sells).toFixed(2);
  }
  
  private static trendArrow(change: number): string {
    if (change > 0.5) return '📈';
    if (change < -0.5) return '📉';
    return '➡️';
  }
  
  private static getRiskEmoji(score: number): string {
    if (score >= 70) return '🔴';
    if (score >= 50) return '🟡';
    return '🟢';
  }
  
  private static getMomentumEmoji(momentum: string): string {
    if (momentum === 'bullish') return '🟢';
    if (momentum === 'bearish') return '🔴';
    return '🟡';
  }
  
  private static volumeIndicator(vol6h: number, vol24h: number): string {
    const ratio = vol6h / vol24h;
    if (ratio > 0.4) return '🔥'; // High recent volume
    if (ratio < 0.15) return '💤'; // Low recent volume
    return '';
  }
  
  private static pressureIndicator(buys: number, sells: number): string {
    const ratio = buys / (sells || 1);
    if (ratio > 1.5) return '🟢 Buy pressure';
    if (ratio < 0.7) return '🔴 Sell pressure';
    return '⚪ Neutral';
  }
  
  private static getConcentrationAssessment(top10: number): string {
    if (top10 > 60) {
      return '⚠️ **High concentration risk** - Top 10 holders control majority of supply';
    } else if (top10 > 40) {
      return '⚠️ **Moderate concentration** - Consider monitoring large holder movements';
    } else if (top10 < 25) {
      return '✅ **Healthy distribution** - Good decentralization among holders';
    } else {
      return '📊 **Average concentration** - Typical for most tokens';
    }
  }
}
