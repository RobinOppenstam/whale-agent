import cron from 'node-cron';
import { WhaleAnalyzer } from './analyzer.js';

export interface TokenConfig {
  address: string;
  symbol: string;
}

export class AnalysisScheduler {
  private analyzer: WhaleAnalyzer;
  private tokens: TokenConfig[];
  private cronSchedule: string;
  private cronJob?: cron.ScheduledTask;
  private isRunning: boolean = false;
  
  constructor(
    analyzer: WhaleAnalyzer,
    tokens: TokenConfig[],
    cronSchedule: string = '0 */6 * * *' // Every 6 hours at :00
  ) {
    this.analyzer = analyzer;
    this.tokens = tokens;
    this.cronSchedule = cronSchedule;
  }
  
  /**
   * Start the scheduler
   */
  start(runImmediately: boolean = false): void {
    console.log('\n' + '🚀'.repeat(40));
    console.log('🚀 WHALE AGENT SCHEDULER STARTED');
    console.log('🚀'.repeat(40));
    console.log(`\n📅 Schedule: ${this.cronSchedule} (every 6 hours)`);
    console.log(`🎯 Tracking ${this.tokens.length} token(s):`);
    this.tokens.forEach(t => console.log(`   - ${t.symbol} (${t.address})`));
    console.log(`⏰ Next run: ${this.getNextRunTime()}\n`);
    
    // Run immediately if requested
    if (runImmediately) {
      console.log('⚡ Running initial analysis immediately...\n');
      this.runAnalysisBatch();
    }
    
    // Schedule recurring runs
    this.cronJob = cron.schedule(this.cronSchedule, () => {
      this.runAnalysisBatch();
    });
    
    this.isRunning = true;
    console.log('✅ Scheduler is now active\n');
  }
  
  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('\n⏹️  Scheduler stopped');
    }
  }
  
  /**
   * Run analysis for all tracked tokens
   */
  private async runAnalysisBatch(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log(`⏰ SCHEDULED ANALYSIS BATCH - ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    
    for (const token of this.tokens) {
      try {
        await this.analyzer.analyzeToken(
          token.address,
          token.symbol,
          true // Send to Telegram
        );
        
        // Small delay between tokens to avoid rate limits
        await this.delay(2000);
        
      } catch (error) {
        console.error(`❌ Failed to analyze ${token.symbol}:`, error);
        // Continue with next token even if one fails
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`✅ BATCH COMPLETE - ${new Date().toISOString()}`);
    console.log(`⏰ Next run: ${this.getNextRunTime()}`);
    console.log('='.repeat(80) + '\n');
  }
  
  /**
   * Manually trigger analysis for a specific token
   */
  async analyzeNow(tokenSymbol: string): Promise<void> {
    const token = this.tokens.find(t => 
      t.symbol.toLowerCase() === tokenSymbol.toLowerCase()
    );
    
    if (!token) {
      console.error(`❌ Token ${tokenSymbol} not found in tracked tokens`);
      return;
    }
    
    console.log(`\n🔧 Manual analysis triggered for ${token.symbol}`);
    await this.analyzer.analyzeToken(token.address, token.symbol, true);
  }
  
  /**
   * Manually trigger analysis for all tokens
   */
  async analyzeAllNow(): Promise<void> {
    console.log('\n🔧 Manual batch analysis triggered for all tokens');
    await this.runAnalysisBatch();
  }
  
  /**
   * Add a token to track
   */
  addToken(address: string, symbol: string): void {
    if (!this.tokens.find(t => t.address.toLowerCase() === address.toLowerCase())) {
      this.tokens.push({ address, symbol });
      console.log(`➕ Added ${symbol} to tracking list`);
    } else {
      console.log(`⚠️  ${symbol} is already being tracked`);
    }
  }
  
  /**
   * Remove a token from tracking
   */
  removeToken(symbolOrAddress: string): void {
    const index = this.tokens.findIndex(t => 
      t.symbol.toLowerCase() === symbolOrAddress.toLowerCase() ||
      t.address.toLowerCase() === symbolOrAddress.toLowerCase()
    );
    
    if (index > -1) {
      const removed = this.tokens.splice(index, 1)[0];
      console.log(`➖ Removed ${removed.symbol} from tracking list`);
    } else {
      console.log(`⚠️  Token not found: ${symbolOrAddress}`);
    }
  }
  
  /**
   * Get list of tracked tokens
   */
  getTrackedTokens(): TokenConfig[] {
    return [...this.tokens];
  }
  
  /**
   * Get next scheduled run time
   */
  getNextRunTime(): string {
    const now = new Date();
    const hours = now.getHours();
    
    // Calculate next 6-hour interval (0, 6, 12, 18)
    const nextHour = Math.ceil((hours + 1) / 6) * 6;
    
    const next = new Date(now);
    next.setHours(nextHour, 0, 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
    }
    
    return next.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
  
  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
