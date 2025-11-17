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
   */
  async analyzeToken(tokenSymbolOrAddress: string): Promise<any> {
    // Find token in tracked list
    const token = this.tokens.find(t => 
      t.symbol.toLowerCase() === tokenSymbolOrAddress.toLowerCase() ||
      t.address.toLowerCase() === tokenSymbolOrAddress.toLowerCase()
    );
    
    if (!token) {
      return {
        error: `Token ${tokenSymbolOrAddress} not found in tracked list`,
        trackedTokens: this.tokens.map(t => t.symbol)
      };
    }
    
    const report = await this.analyzer.analyzeToken(
      token.address,
      token.symbol,
      false // Don't send to Telegram for on-demand queries
    );
    
    return {
      success: true,
      token: token.symbol,
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
   * Action: Add a new token to track
   */
  addToken(address: string, symbol: string): any {
    this.scheduler.addToken(address, symbol);
    this.tokens.push({ address, symbol });
    
    return {
      success: true,
      message: `Added ${symbol} to tracking`,
      trackedTokens: this.tokens.map(t => t.symbol)
    };
  }
  
  /**
   * Action: Remove a token from tracking
   */
  removeToken(symbolOrAddress: string): any {
    this.scheduler.removeToken(symbolOrAddress);
    this.tokens = this.tokens.filter(t =>
      t.symbol.toLowerCase() !== symbolOrAddress.toLowerCase() &&
      t.address.toLowerCase() !== symbolOrAddress.toLowerCase()
    );
    
    return {
      success: true,
      message: `Removed ${symbolOrAddress} from tracking`,
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
          description: 'Analyze a specific token and get comprehensive whale report',
          parameters: ['tokenSymbolOrAddress: string']
        },
        {
          name: 'getStatus',
          description: 'Get current status of the agent and tracked tokens',
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
          description: 'Add a new token to the tracking list',
          parameters: ['address: string', 'symbol: string']
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
