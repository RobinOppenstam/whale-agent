import { WhaleAnalyzer } from './analyzer.js';
import { AnalysisScheduler, TokenConfig } from './scheduler.js';

/**
 * G.A.M.E Agent Wrapper
 * This is the main agent interface for Virtuals Protocol
 * Provides both on-demand and scheduled analysis capabilities
 */
export class GameAgent {
  private analyzer: WhaleAnalyzer;
  private scheduler: AnalysisScheduler;
  private tokens: TokenConfig[];
  
  constructor(
    rpcUrl: string,
    backupRpcUrl: string,
    databaseUrl: string,
    tokens: TokenConfig[],
    cronSchedule: string,
    telegramToken?: string,
    telegramChatId?: string,
    graphApiKey?: string
  ) {
    // Initialize analyzer
    this.analyzer = new WhaleAnalyzer(
      rpcUrl,
      backupRpcUrl,
      databaseUrl,
      telegramToken,
      telegramChatId,
      graphApiKey
    );
    
    // Initialize scheduler
    this.scheduler = new AnalysisScheduler(
      this.analyzer,
      tokens,
      cronSchedule
    );
    
    this.tokens = tokens;
  }
  
  /**
   * Initialize the agent
   * Tests connections and starts the scheduler
   */
  async initialize(): Promise<void> {
    console.log('\n' + '🤖'.repeat(40));
    console.log('🤖 INITIALIZING G.A.M.E WHALE AGENT');
    console.log('🤖'.repeat(40) + '\n');

    // Test connections
    await this.analyzer.testConnections();

    // Initialize Telegram bot commands
    await this.analyzer.initializeTelegramCommands(this);

    // Start scheduler
    this.scheduler.start(true); // Run immediately on start

    console.log('🎮 G.A.M.E Agent is now active and ready!\n');
  }
  
  /**
   * Query: Analyze a specific token on-demand
   * Works with both tracked tokens (by symbol) and any Base chain token (by address)
   */
  async analyzeToken(tokenSymbolOrAddress: string): Promise<any> {
    let tokenAddress: string;
    let tokenSymbol: string;

    // Check if input looks like an Ethereum address
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(tokenSymbolOrAddress);

    if (isAddress) {
      // Input is an address - analyze any Base chain token
      tokenAddress = tokenSymbolOrAddress;

      // Try to fetch symbol from DexScreener
      console.log(`🔍 Analyzing token by address: ${tokenAddress}`);
      const { DexScreenerClient } = await import('./services/dexscreener.js');
      const dexscreener = new DexScreenerClient();
      const fetchedSymbol = await dexscreener.fetchTokenSymbol(tokenAddress);

      if (!fetchedSymbol) {
        return {
          error: `Token not found on DexScreener. It may not be on Base chain or have no liquidity pools.`,
          hint: `Try providing the symbol manually if you know it`
        };
      }

      tokenSymbol = fetchedSymbol;
      console.log(`✅ Found symbol: ${tokenSymbol}`);
    } else {
      // Input is a symbol - try to find in tracked tokens
      const token = this.tokens.find(t =>
        t.symbol.toLowerCase() === tokenSymbolOrAddress.toLowerCase()
      );

      if (!token) {
        return {
          error: `Token symbol "${tokenSymbolOrAddress}" not found in tracked list. To analyze any Base chain token, use its contract address (0x...) instead.`,
          trackedTokens: this.tokens.map(t => t.symbol)
        };
      }

      tokenAddress = token.address;
      tokenSymbol = token.symbol;
    }

    // Perform analysis
    const report = await this.analyzer.analyzeToken(
      tokenAddress,
      tokenSymbol,
      false // Don't send to Telegram for on-demand queries
    );

    return {
      success: true,
      token: tokenSymbol,
      isTracked: this.tokens.some(t => t.address.toLowerCase() === tokenAddress.toLowerCase()),
      report: {
        timestamp: report.reportTimestamp,
        riskScore: report.riskScore,
        price: report.currentPrice,
        priceChange6h: report.priceChange6h,
        priceChange24h: report.priceChange24h,
        volume24h: report.volume24h,
        concentration: {
          top10: report.top10Concentration,
          top20: report.top20Concentration,
          top50: report.top50Concentration
        },
        whaleActivity: {
          newWhales: report.newWhalesCount,
          exitedWhales: report.exitedWhalesCount,
          accumulating: report.accumulatingWhales,
          distributing: report.distributingWhales
        },
        signals: report.signals,
        concerns: report.concerns,
        positiveIndicators: report.positiveIndicators
      },
      markdown: report.reportMarkdown
    };
  }
  
  /**
   * Query: Get status of all tracked tokens
   */
  getStatus(): any {
    return {
      active: this.scheduler.isActive(),
      trackedTokens: this.tokens.map(t => ({
        symbol: t.symbol,
        address: t.address
      })),
      nextScheduledRun: this.scheduler.getNextRunTime(),
      schedule: 'Every 6 hours'
    };
  }

  /**
   * Query: Generate portfolio dashboard for all tracked tokens
   */
  async getPortfolio(): Promise<any> {
    console.log(`📊 Generating portfolio dashboard for ${this.tokens.length} tokens...`);

    try {
      // Analyze all tokens and collect reports
      const reportPromises = this.tokens.map(async (token) => {
        try {
          const whaleReport = await this.analyzer.analyzeToken(
            token.address,
            token.symbol,
            false // Don't send to Telegram
          );
          // reportJson contains the full ReportData object
          return whaleReport.reportJson;
        } catch (error: any) {
          console.error(`Failed to analyze ${token.symbol}:`, error.message);
          return null;
        }
      });

      const reports = (await Promise.all(reportPromises)).filter((r): r is any => r !== null);

      if (reports.length === 0) {
        return {
          error: 'Failed to analyze any tokens',
          trackedTokens: this.tokens.map(t => t.symbol)
        };
      }

      // Generate portfolio dashboard
      const { ReportGenerator } = await import('./services/report-generator.js');
      const dashboard = ReportGenerator.generatePortfolioDashboard(reports);

      console.log(`✅ Portfolio dashboard generated for ${reports.length}/${this.tokens.length} tokens`);

      return {
        success: true,
        tokensAnalyzed: reports.length,
        totalTokens: this.tokens.length,
        markdown: dashboard
      };
    } catch (error: any) {
      console.error('Portfolio generation error:', error);
      return {
        error: `Failed to generate portfolio: ${error.message}`
      };
    }
  }

  /**
   * Action: Trigger immediate analysis for all tokens
   */
  async triggerAnalysis(): Promise<any> {
    await this.scheduler.analyzeAllNow();
    return {
      success: true,
      message: 'Analysis triggered for all tokens',
      tokens: this.tokens.map(t => t.symbol)
    };
  }
  
  /**
   * Initialize a newly added token with current data snapshot
   * This creates the first database entries for trending analysis
   */
  private async initializeNewToken(address: string, symbol: string): Promise<void> {
    console.log(`\n🔄 Initializing ${symbol} with current data snapshot...`);

    try {
      // Fetch and store current token metrics (for price trends)
      const { DexScreenerClient } = await import('./services/dexscreener.js');
      const dexscreener = new DexScreenerClient();

      console.log('📊 Fetching current metrics from DexScreener...');
      const metrics = await dexscreener.fetchTokenMetrics(address);

      if (metrics) {
        await this.analyzer['database'].storeTokenSnapshot(metrics);
        console.log('✅ Token metrics snapshot stored');
      }

      // Note: Historical backfilling is not available via DexScreener API
      // The agent will build historical data going forward through scheduled runs
      console.log('💡 Historical data will accumulate as the agent runs scheduled analyses');
      console.log(`   First trends will be available after 6+ hours of tracking\n`);

    } catch (error: any) {
      console.error(`⚠️  Failed to initialize ${symbol}:`, error.message);
      console.log('   Token added to tracking, but initial snapshot failed');
      console.log('   Data will be collected during next scheduled run\n');
    }
  }

  /**
   * Action: Add a new token to track
   * Symbol is optional - will be fetched from DexScreener if not provided
   * Automatically initializes the token with current data snapshot
   */
  async addToken(address: string, symbol?: string): Promise<any> {
    try {
      // Check if token is already tracked
      const normalizedAddress = address.toLowerCase();
      const existingToken = this.tokens.find(t =>
        t.address.toLowerCase() === normalizedAddress
      );

      if (existingToken) {
        return {
          error: `Token ${existingToken.symbol} (${address.substring(0, 10)}...) is already being tracked`,
          trackedTokens: this.tokens.map(t => t.symbol)
        };
      }

      // If symbol not provided, fetch it from DexScreener
      let tokenSymbol: string | undefined = symbol;
      if (!tokenSymbol) {
        console.log(`🔍 Fetching symbol for ${address} from DexScreener...`);
        const { DexScreenerClient } = await import('./services/dexscreener.js');
        const dexscreener = new DexScreenerClient();
        const fetchedSymbol = await dexscreener.fetchTokenSymbol(address);

        if (!fetchedSymbol) {
          return {
            error: `Failed to fetch token symbol for ${address}. Please provide symbol manually.`
          };
        }

        tokenSymbol = fetchedSymbol;
        console.log(`✅ Found symbol: ${tokenSymbol}`);
      }

      // Add to scheduler and tokens list
      this.scheduler.addToken(address, tokenSymbol);
      this.tokens.push({ address, symbol: tokenSymbol });

      // Initialize with current data snapshot (async, don't wait)
      this.initializeNewToken(address, tokenSymbol).catch(err => {
        console.error(`Background initialization failed for ${tokenSymbol}:`, err);
      });

      return {
        success: true,
        message: `Added ${tokenSymbol} (${address.substring(0, 10)}...) to tracking. Initializing with current data...`,
        trackedTokens: this.tokens.map(t => t.symbol)
      };
    } catch (error: any) {
      return {
        error: `Failed to add token: ${error.message}`
      };
    }
  }
  
  /**
   * Action: Remove a token from tracking
   */
  removeToken(symbolOrAddress: string): any {
    const initialLength = this.tokens.length;

    this.scheduler.removeToken(symbolOrAddress);
    this.tokens = this.tokens.filter(t =>
      t.symbol.toLowerCase() !== symbolOrAddress.toLowerCase() &&
      t.address.toLowerCase() !== symbolOrAddress.toLowerCase()
    );

    const removedCount = initialLength - this.tokens.length;

    if (removedCount === 0) {
      return {
        error: `Token ${symbolOrAddress} not found in tracking list`,
        trackedTokens: this.tokens.map(t => t.symbol)
      };
    }

    return {
      success: true,
      message: `Removed ${removedCount > 1 ? removedCount + ' instances of ' : ''}${symbolOrAddress} from tracking`,
      trackedTokens: this.tokens.map(t => t.symbol)
    };
  }

  /**
   * Utility: Remove duplicate tokens from tracking list
   */
  removeDuplicates(): any {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    const initialLength = this.tokens.length;

    this.tokens = this.tokens.filter(t => {
      const key = t.address.toLowerCase();
      if (seen.has(key)) {
        duplicates.push(t.symbol);
        return false;
      }
      seen.add(key);
      return true;
    });

    const removedCount = initialLength - this.tokens.length;

    // Also clean up scheduler
    const uniqueTokens = Array.from(seen).map(addr => {
      const token = this.tokens.find(t => t.address.toLowerCase() === addr);
      return token!;
    });

    return {
      success: true,
      message: removedCount > 0
        ? `Removed ${removedCount} duplicate token(s): ${[...new Set(duplicates)].join(', ')}`
        : 'No duplicates found',
      trackedTokens: this.tokens.map(t => t.symbol)
    };
  }
  
  /**
   * Shutdown the agent
   */
  shutdown(): void {
    console.log('\n👋 Shutting down G.A.M.E Whale Agent...');
    this.scheduler.stop();
    this.analyzer.stopTelegramPolling();
    console.log('✅ Agent stopped successfully\n');
  }
  
  /**
   * Get agent capabilities (for G.A.M.E protocol)
   */
  static getCapabilities(): any {
    return {
      name: 'Whale Agent',
      description: 'AI agent for tracking whale activity, analyzing token metrics, and detecting accumulation/distribution patterns',
      version: '1.0.0',
      author: 'Virtuals Protocol',
      queries: [
        {
          name: 'analyzeToken',
          description: 'Analyze ANY Base chain token (tracked or not) and get comprehensive whale report. Use token symbol for tracked tokens, or contract address (0x...) for any Base token. First-time analysis may have limited trend data.',
          parameters: ['tokenSymbolOrAddress: string (symbol or 0x... address)']
        },
        {
          name: 'getStatus',
          description: 'Get current status of the agent and tracked tokens',
          parameters: []
        },
        {
          name: 'getPortfolio',
          description: 'Generate portfolio dashboard for all tracked tokens with opportunities and risk alerts',
          parameters: []
        }
      ],
      actions: [
        {
          name: 'triggerAnalysis',
          description: 'Manually trigger analysis for all tracked tokens',
          parameters: []
        },
        {
          name: 'addToken',
          description: 'Add a new token to the tracking list (symbol auto-fetched from DexScreener if not provided)',
          parameters: ['address: string', 'symbol?: string']
        },
        {
          name: 'removeToken',
          description: 'Remove a token from the tracking list',
          parameters: ['symbolOrAddress: string']
        }
      ],
      scheduled: {
        frequency: 'Every 6 hours',
        description: 'Automatically analyzes all tracked tokens and sends reports to Telegram'
      }
    };
  }
}
