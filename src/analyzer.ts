import { DexScreenerClient, TokenMetrics } from './services/dexscreener.js';
import { HolderDataClient, HolderSnapshot } from './services/holders.js';
import { DatabaseService, WhaleReport } from './services/database.js';
import { ReportGenerator, ReportData } from './services/report-generator.js';
import { TelegramService } from './services/telegram.js';

export class WhaleAnalyzer {
  private dexscreener: DexScreenerClient;
  private holderClient: HolderDataClient;
  private database: DatabaseService;
  private telegram?: TelegramService;
  
  constructor(
    rpcUrl: string,
    backupRpcUrl: string,
    databaseUrl: string,
    telegramToken?: string,
    telegramChatId?: string,
    graphApiKey?: string
  ) {
    this.dexscreener = new DexScreenerClient();
    this.holderClient = new HolderDataClient(rpcUrl, backupRpcUrl, graphApiKey);
    this.database = new DatabaseService(databaseUrl);
    
    if (telegramToken && telegramChatId) {
      this.telegram = new TelegramService(telegramToken, telegramChatId);
    }
  }
  
  /**
   * Run complete whale analysis and generate report
   */
  async analyzeToken(
    tokenAddress: string,
    tokenSymbol: string,
    sendToTelegram: boolean = true
  ): Promise<WhaleReport> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Starting analysis for ${tokenSymbol} (${tokenAddress})`);
    console.log(`${'='.repeat(80)}\n`);
    
    try {
      // 1. Fetch current metrics from DexScreener
      console.log('📊 Fetching price and volume data from DexScreener...');
      const metrics = await this.dexscreener.fetchTokenMetrics(tokenAddress);
      if (!metrics) {
        throw new Error('Failed to fetch token metrics from DexScreener');
      }
      
      // Store snapshot
      await this.database.storeTokenSnapshot(metrics);
      console.log('✅ Token metrics stored');
      
      // 2. Fetch current holder data
      console.log('🐋 Fetching top 50 holder data...');
      const currentSnapshot = await this.holderClient.fetchTopHolders(tokenAddress, 50);
      console.log(`✅ Holder data fetched - Top holders: ${currentSnapshot.topHolders.length}`);

      // Store whale positions
      console.log('💾 Storing whale positions in database...');
      await this.database.storeWhalePositions(currentSnapshot, metrics.priceUsd);
      console.log('✅ Whale positions stored');
      
      // 3. Get previous snapshot (6h ago)
      console.log('🕐 Retrieving previous snapshot for comparison...');
      const previousSnapshot = await this.database.getPreviousWhaleSnapshot(tokenAddress, 6);
      
      // 4. Compare snapshots and detect changes
      let newWhales: any[] = [];
      let exitedWhales: any[] = [];
      let changes: any[] = [];
      
      if (previousSnapshot) {
        const comparison = HolderDataClient.compareSnapshots(
          previousSnapshot,
          currentSnapshot
        );
        newWhales = comparison.newWhales;
        exitedWhales = comparison.exitedWhales;
        changes = comparison.changes;
        console.log(`📈 Changes detected: ${newWhales.length} new, ${exitedWhales.length} exited, ${changes.length} modified`);
      } else {
        console.log('⚠️  No previous snapshot found - this may be the first analysis');
      }
      
      // 5. Get concentration trends
      console.log('📊 Calculating concentration trends...');
      const trends = await this.database.getConcentrationTrends(tokenAddress);
      
      // 6. Analyze chart health
      console.log('📈 Analyzing chart health...');
      const chartHealth = DexScreenerClient.analyzeChartHealth(metrics);
      
      // 7. Separate accumulators and distributors
      const accumulators = changes
        .filter(c => c.percentageChange > 1)
        .sort((a, b) => b.percentageChange - a.percentageChange);
      
      const distributors = changes
        .filter(c => c.percentageChange < -1)
        .sort((a, b) => a.percentageChange - b.percentageChange);
      
      // 8. Perform risk analysis
      console.log('⚠️  Performing risk analysis...');
      const riskAnalysis = this.analyzeRisks(
        currentSnapshot,
        accumulators,
        distributors,
        trends,
        chartHealth,
        metrics
      );
      
      // 9. Build report data
      const reportData: ReportData = {
        tokenAddress,
        tokenSymbol,
        timestamp: new Date(),
        metrics,
        chartHealth,
        currentSnapshot,
        previousSnapshot: previousSnapshot || undefined,
        newWhales,
        exitedWhales,
        accumulators,
        distributors,
        concentrationChange6h: trends.change6h,
        concentrationChange24h: trends.change24h,
        concentrationChange7d: trends.change7d,
        riskScore: riskAnalysis.riskScore,
        signals: riskAnalysis.signals,
        concerns: riskAnalysis.concerns,
        positiveIndicators: riskAnalysis.positiveIndicators
      };
      
      // 10. Generate markdown report
      console.log('📝 Generating markdown report...');
      const markdown = ReportGenerator.generateMarkdown(reportData);
      
      // 11. Create whale report object
      const report: WhaleReport = {
        tokenAddress,
        reportTimestamp: new Date(),
        totalHolders: currentSnapshot.totalHolders,
        top10Concentration: currentSnapshot.top10Concentration,
        top20Concentration: currentSnapshot.top20Concentration,
        top50Concentration: currentSnapshot.top50Concentration,
        currentPrice: metrics.priceUsd,
        priceChange6h: metrics.priceChange6h,
        priceChange24h: metrics.priceChange24h,
        volume6h: metrics.volume6h,
        volume24h: metrics.volume24h,
        liquidityUsd: metrics.liquidityUsd,
        concentrationChange6h: trends.change6h,
        newWhalesCount: newWhales.length,
        exitedWhalesCount: exitedWhales.length,
        accumulatingWhales: accumulators.length,
        distributingWhales: distributors.length,
        netWhaleFlowUsd: this.calculateNetFlow(accumulators, distributors, metrics.priceUsd),
        riskScore: riskAnalysis.riskScore,
        signals: riskAnalysis.signals,
        concerns: riskAnalysis.concerns,
        positiveIndicators: riskAnalysis.positiveIndicators,
        reportJson: reportData,
        reportMarkdown: markdown
      };
      
      // 12. Store report in database
      console.log('💾 Storing report in database...');
      await this.database.storeWhaleReport(report);
      
      // 13. Send to Telegram if enabled
      if (sendToTelegram && this.telegram) {
        console.log('📱 Sending report to Telegram...');
        await this.telegram.sendReport(markdown, tokenSymbol);
        await this.database.markReportSent(tokenAddress, report.reportTimestamp);
      }
      
      console.log(`\n✅ Analysis complete for ${tokenSymbol}`);
      console.log(`   Risk Score: ${report.riskScore}/100`);
      console.log(`   Top 10 Concentration: ${report.top10Concentration.toFixed(2)}%`);
      console.log(`   Price Change (6h): ${report.priceChange6h.toFixed(2)}%`);
      console.log(`   Volume (6h): $${report.volume6h.toFixed(2)}`);
      console.log(`${'='.repeat(80)}\n`);
      
      return report;
      
    } catch (error) {
      console.error(`❌ Error analyzing ${tokenSymbol}:`, error);
      
      // Send error alert to Telegram
      if (this.telegram) {
        await this.telegram.sendAlert(
          `Failed to analyze ${tokenSymbol}\nError: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      
      throw error;
    }
  }
  
  /**
   * Analyze risks based on all gathered data
   */
  private analyzeRisks(
    snapshot: HolderSnapshot,
    accumulators: any[],
    distributors: any[],
    trends: any,
    chartHealth: any,
    metrics: TokenMetrics
  ): {
    riskScore: number;
    signals: string[];
    concerns: string[];
    positiveIndicators: string[];
  } {
    const signals: string[] = [];
    const concerns: string[] = [];
    const positiveIndicators: string[] = [];
    let riskScore = 50; // Base score
    
    // Concentration analysis
    if (snapshot.top10Concentration > 60) {
      concerns.push('Very high concentration - top 10 hold >60% of supply');
      signals.push('high_concentration');
      riskScore += 20;
    } else if (snapshot.top10Concentration < 30) {
      positiveIndicators.push('Healthy distribution - top 10 hold <30% of supply');
      riskScore -= 10;
    }
    
    // Largest holder check
    if (snapshot.topHolders[0]?.percentageOfSupply > 20) {
      concerns.push(`Single wallet holds ${snapshot.topHolders[0].percentageOfSupply.toFixed(2)}% of supply`);
      riskScore += 15;
    }
    
    // Whale behavior
    if (distributors.length > accumulators.length * 2) {
      concerns.push('More whales distributing than accumulating');
      signals.push('distribution_pressure');
      riskScore += 15;
    } else if (accumulators.length > distributors.length * 2) {
      positiveIndicators.push('Strong whale accumulation detected');
      signals.push('accumulation_trend');
      riskScore -= 15;
    }
    
    // Concentration trend
    if (trends.change24h > 5) {
      concerns.push('Concentration increased >5% in 24h - possible centralization');
      riskScore += 10;
    } else if (trends.change24h < -5) {
      positiveIndicators.push('Concentration decreased >5% in 24h - improving distribution');
      riskScore -= 10;
    }
    
    // Rapid accumulation
    const rapidAcc = accumulators.filter(a => Math.abs(a.percentageChange) > 10);
    if (rapidAcc.length > 3) {
      signals.push('rapid_accumulation');
      positiveIndicators.push(`${rapidAcc.length} whales rapidly accumulating (>10% each)`);
      riskScore -= 5;
    }
    
    // Chart health integration
    if (chartHealth.momentum === 'bearish') {
      concerns.push('Bearish chart momentum detected');
      riskScore += 10;
    } else if (chartHealth.momentum === 'bullish') {
      positiveIndicators.push('Bullish chart momentum detected');
      riskScore -= 10;
    }
    
    // Liquidity check
    if (metrics.liquidityUsd < 50000) {
      concerns.push('Low liquidity (<$50k) - high slippage risk');
      riskScore += 15;
    } else if (metrics.liquidityUsd > 500000) {
      positiveIndicators.push('Strong liquidity (>$500k)');
      riskScore -= 5;
    }
    
    // Volume analysis
    if (metrics.volume6h > metrics.volume24h * 0.5) {
      signals.push('high_recent_volume');
      positiveIndicators.push('50%+ of 24h volume occurred in last 6 hours');
    }
    
    // Buy/sell pressure
    if (metrics.txns6hBuys > metrics.txns6hSells * 1.5) {
      positiveIndicators.push('Strong buy pressure in last 6 hours');
      riskScore -= 5;
    } else if (metrics.txns6hSells > metrics.txns6hBuys * 1.5) {
      concerns.push('Strong sell pressure in last 6 hours');
      riskScore += 5;
    }
    
    // Clamp risk score
    riskScore = Math.max(0, Math.min(100, riskScore));
    
    return {
      riskScore,
      signals,
      concerns,
      positiveIndicators
    };
  }
  
  /**
   * Calculate net whale flow in USD
   */
  private calculateNetFlow(
    accumulators: any[],
    distributors: any[],
    priceUsd: number
  ): number {
    const accFlow = accumulators.reduce((sum, a) => sum + (a.balanceChange || 0), 0);
    const distFlow = distributors.reduce((sum, d) => sum + (d.balanceChange || 0), 0);
    return (accFlow + distFlow) * priceUsd;
  }
  
  /**
   * Test all connections
   */
  async testConnections(): Promise<void> {
    console.log('🔧 Testing connections...\n');
    
    // Test Telegram
    if (this.telegram) {
      const telegramOk = await this.telegram.testConnection();
      console.log(`Telegram: ${telegramOk ? '✅' : '❌'}`);
    } else {
      console.log('Telegram: ⏭️  Not configured');
    }
    
    console.log('\n✅ Connection tests complete');
  }
}
