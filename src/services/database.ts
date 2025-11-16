import pg from 'pg';
const { Pool } = pg;
import { TokenMetrics } from './dexscreener.js';
import { HolderSnapshot, HolderData } from './holders.js';

export interface WhaleReport {
  tokenAddress: string;
  reportTimestamp: Date;
  
  // Summary
  totalHolders: number;
  top10Concentration: number;
  top20Concentration: number;
  top50Concentration: number;
  
  // Price & Volume
  currentPrice: number;
  priceChange6h: number;
  priceChange24h: number;
  volume6h: number;
  volume24h: number;
  liquidityUsd: number;
  
  // Changes
  concentrationChange6h: number;
  newWhalesCount: number;
  exitedWhalesCount: number;
  
  // Whale activity
  accumulatingWhales: number;
  distributingWhales: number;
  netWhaleFlowUsd: number;
  
  // Risk
  riskScore: number;
  signals: string[];
  concerns: string[];
  positiveIndicators: string[];
  
  // Full data
  reportJson: any;
  reportMarkdown: string;
}

export class DatabaseService {
  private pool: pg.Pool;
  
  constructor(connectionString?: string) {
    // Railway automatically provides DATABASE_URL
    const dbUrl = connectionString || process.env.DATABASE_URL;
    
    if (!dbUrl) {
      throw new Error('DATABASE_URL not provided. Railway should inject this automatically.');
    }
    
    this.pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test connection
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  
  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Railway database connected:', result.rows[0].now);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }
  
  /**
   * Initialize database schema (run on first deployment)
   */
  async initializeSchema(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf-8');
      
      await this.pool.query(schema);
      console.log('✅ Database schema initialized');
    } catch (error) {
      console.error('❌ Schema initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Store token snapshot
   */
  async storeTokenSnapshot(metrics: TokenMetrics): Promise<void> {
    const query = `
      INSERT INTO token_snapshots (
        token_address, timestamp, price_usd, price_change_5m, price_change_1h,
        price_change_6h, price_change_24h, volume_5m, volume_1h, volume_6h,
        volume_24h, liquidity_usd, market_cap, txns_5m_buys, txns_5m_sells,
        txns_1h_buys, txns_1h_sells, txns_6h_buys, txns_6h_sells,
        txns_24h_buys, txns_24h_sells, data_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (token_address, timestamp) DO UPDATE SET
        price_usd = EXCLUDED.price_usd,
        volume_6h = EXCLUDED.volume_6h,
        volume_24h = EXCLUDED.volume_24h
    `;
    
    const values = [
      metrics.tokenAddress,
      metrics.timestamp,
      metrics.priceUsd,
      metrics.priceChange5m,
      metrics.priceChange1h,
      metrics.priceChange6h,
      metrics.priceChange24h,
      metrics.volume5m,
      metrics.volume1h,
      metrics.volume6h,
      metrics.volume24h,
      metrics.liquidityUsd,
      metrics.marketCap,
      metrics.txns5mBuys,
      metrics.txns5mSells,
      metrics.txns1hBuys,
      metrics.txns1hSells,
      metrics.txns6hBuys,
      metrics.txns6hSells,
      metrics.txns24hBuys,
      metrics.txns24hSells,
      'dexscreener'
    ];
    
    try {
      await this.pool.query(query, values);
    } catch (error) {
      console.error('Error storing token snapshot:', error);
      throw error;
    }
  }
  
  /**
   * Store whale positions
   */
  async storeWhalePositions(
    snapshot: HolderSnapshot,
    priceUsd: number
  ): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const insertQuery = `
        INSERT INTO whale_positions (
          token_address, wallet_address, timestamp, balance,
          percentage_of_supply, holder_rank, value_usd
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (token_address, wallet_address, timestamp) DO NOTHING
      `;
      
      for (const holder of snapshot.topHolders) {
        await client.query(insertQuery, [
          snapshot.tokenAddress,
          holder.address,
          snapshot.timestamp,
          holder.balance,
          holder.percentageOfSupply,
          holder.rank,
          holder.balanceFormatted * priceUsd
        ]);
      }
      
      // Update latest snapshot with concentration data
      const updateQuery = `
        UPDATE token_snapshots
        SET 
          total_holders = $1,
          top_10_concentration = $2,
          top_20_concentration = $3,
          top_50_concentration = $4
        WHERE token_address = $5
          AND timestamp = (
            SELECT MAX(timestamp) 
            FROM token_snapshots 
            WHERE token_address = $5
          )
      `;
      
      await client.query(updateQuery, [
        snapshot.totalHolders,
        snapshot.top10Concentration,
        snapshot.top20Concentration,
        snapshot.top50Concentration,
        snapshot.tokenAddress
      ]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error storing whale positions:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get previous whale snapshot
   */
  async getPreviousWhaleSnapshot(
    tokenAddress: string,
    hoursAgo: number
  ): Promise<HolderSnapshot | null> {
    const query = `
      SELECT wallet_address, balance, percentage_of_supply, holder_rank, timestamp
      FROM whale_positions
      WHERE token_address = $1
        AND timestamp <= NOW() - INTERVAL '${hoursAgo} hours'
      ORDER BY timestamp DESC, holder_rank ASC
      LIMIT 50
    `;
    
    try {
      const result = await this.pool.query(query, [tokenAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const topHolders: HolderData[] = result.rows.map((row: any) => ({
        address: row.wallet_address,
        balance: row.balance,
        balanceFormatted: parseFloat(row.balance),
        percentageOfSupply: parseFloat(row.percentage_of_supply),
        rank: row.holder_rank
      }));
      
      return {
        tokenAddress,
        timestamp: new Date(result.rows[0].timestamp),
        totalHolders: 0,
        topHolders,
        top10Concentration: topHolders.slice(0, 10).reduce((s, h) => s + h.percentageOfSupply, 0),
        top20Concentration: topHolders.slice(0, 20).reduce((s, h) => s + h.percentageOfSupply, 0),
        top50Concentration: topHolders.reduce((s, h) => s + h.percentageOfSupply, 0)
      };
    } catch (error) {
      console.error('Error fetching previous whale snapshot:', error);
      return null;
    }
  }
  
  /**
   * Get concentration trends
   */
  async getConcentrationTrends(tokenAddress: string): Promise<{
    change6h: number;
    change24h: number;
    change7d: number;
  }> {
    const query = `
      SELECT top_10_concentration, timestamp
      FROM token_snapshots
      WHERE token_address = $1
        AND timestamp >= NOW() - INTERVAL '7 days'
      ORDER BY timestamp DESC
    `;
    
    try {
      const result = await this.pool.query(query, [tokenAddress]);
      
      if (result.rows.length === 0) {
        return { change6h: 0, change24h: 0, change7d: 0 };
      }
      
      const current = result.rows[0].top_10_concentration || 0;
      const now = new Date();
      
      const find6h = result.rows.find((r: any) => {
        const diff = now.getTime() - new Date(r.timestamp).getTime();
        return diff >= 5.5 * 3600000 && diff <= 6.5 * 3600000;
      });
      
      const find24h = result.rows.find((r: any) => {
        const diff = now.getTime() - new Date(r.timestamp).getTime();
        return diff >= 23 * 3600000 && diff <= 25 * 3600000;
      });
      
      const find7d = result.rows[result.rows.length - 1];
      
      return {
        change6h: find6h ? current - (find6h.top_10_concentration || 0) : 0,
        change24h: find24h ? current - (find24h.top_10_concentration || 0) : 0,
        change7d: find7d ? current - (find7d.top_10_concentration || 0) : 0
      };
    } catch (error) {
      console.error('Error fetching concentration trends:', error);
      return { change6h: 0, change24h: 0, change7d: 0 };
    }
  }
  
  /**
   * Store whale report
   */
  async storeWhaleReport(report: WhaleReport): Promise<void> {
    const query = `
      INSERT INTO whale_reports (
        token_address, report_timestamp, total_holders, top_10_concentration,
        top_20_concentration, top_50_concentration, current_price, price_change_6h,
        price_change_24h, volume_6h, volume_24h, liquidity_usd,
        concentration_change_6h, new_whales_count, exited_whales_count,
        accumulating_whales, distributing_whales, net_whale_flow_usd,
        risk_score, signals, concerns, positive_indicators,
        report_json, report_markdown
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (token_address, report_timestamp) DO NOTHING
    `;
    
    const values = [
      report.tokenAddress,
      report.reportTimestamp,
      report.totalHolders,
      report.top10Concentration,
      report.top20Concentration,
      report.top50Concentration,
      report.currentPrice,
      report.priceChange6h,
      report.priceChange24h,
      report.volume6h,
      report.volume24h,
      report.liquidityUsd,
      report.concentrationChange6h,
      report.newWhalesCount,
      report.exitedWhalesCount,
      report.accumulatingWhales,
      report.distributingWhales,
      report.netWhaleFlowUsd,
      report.riskScore,
      JSON.stringify(report.signals),
      JSON.stringify(report.concerns),
      JSON.stringify(report.positiveIndicators),
      JSON.stringify(report.reportJson),
      report.reportMarkdown
    ];
    
    try {
      await this.pool.query(query, values);
    } catch (error) {
      console.error('Error storing whale report:', error);
      throw error;
    }
  }
  
  /**
   * Mark report as sent to Telegram
   */
  async markReportSent(tokenAddress: string, reportTimestamp: Date): Promise<void> {
    const query = `
      UPDATE whale_reports
      SET telegram_sent = true, telegram_sent_at = NOW()
      WHERE token_address = $1 AND report_timestamp = $2
    `;
    
    try {
      await this.pool.query(query, [tokenAddress, reportTimestamp]);
    } catch (error) {
      console.error('Error marking report as sent:', error);
    }
  }
  
  /**
   * Get latest token metrics
   */
  async getLatestMetrics(tokenAddress: string): Promise<TokenMetrics | null> {
    const query = `
      SELECT * FROM token_snapshots
      WHERE token_address = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    
    try {
      const result = await this.pool.query(query, [tokenAddress]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        tokenAddress,
        timestamp: new Date(row.timestamp),
        priceUsd: parseFloat(row.price_usd),
        priceChange5m: parseFloat(row.price_change_5m),
        priceChange1h: parseFloat(row.price_change_1h),
        priceChange6h: parseFloat(row.price_change_6h),
        priceChange24h: parseFloat(row.price_change_24h),
        volume5m: parseFloat(row.volume_5m),
        volume1h: parseFloat(row.volume_1h),
        volume6h: parseFloat(row.volume_6h),
        volume24h: parseFloat(row.volume_24h),
        liquidityUsd: parseFloat(row.liquidity_usd),
        marketCap: parseFloat(row.market_cap),
        txns5mBuys: row.txns_5m_buys,
        txns5mSells: row.txns_5m_sells,
        txns1hBuys: row.txns_1h_buys,
        txns1hSells: row.txns_1h_sells,
        txns6hBuys: row.txns_6h_buys,
        txns6hSells: row.txns_6h_sells,
        txns24hBuys: row.txns_24h_buys,
        txns24hSells: row.txns_24h_sells,
        buySellRatio5m: row.txns_5m_sells ? row.txns_5m_buys / row.txns_5m_sells : 0,
        buySellRatio1h: row.txns_1h_sells ? row.txns_1h_buys / row.txns_1h_sells : 0,
        buySellRatio6h: row.txns_6h_sells ? row.txns_6h_buys / row.txns_6h_sells : 0,
        buySellRatio24h: row.txns_24h_sells ? row.txns_24h_buys / row.txns_24h_sells : 0
      };
    } catch (error) {
      console.error('Error fetching latest metrics:', error);
      return null;
    }
  }
  
  /**
   * Get all reports for a token
   */
  async getReports(tokenAddress: string, limit: number = 10): Promise<WhaleReport[]> {
    const query = `
      SELECT * FROM whale_reports
      WHERE token_address = $1
      ORDER BY report_timestamp DESC
      LIMIT $2
    `;
    
    try {
      const result = await this.pool.query(query, [tokenAddress, limit]);
      
      return result.rows.map((row: any) => ({
        tokenAddress: row.token_address,
        reportTimestamp: new Date(row.report_timestamp),
        totalHolders: row.total_holders,
        top10Concentration: parseFloat(row.top_10_concentration),
        top20Concentration: parseFloat(row.top_20_concentration),
        top50Concentration: parseFloat(row.top_50_concentration),
        currentPrice: parseFloat(row.current_price),
        priceChange6h: parseFloat(row.price_change_6h),
        priceChange24h: parseFloat(row.price_change_24h),
        volume6h: parseFloat(row.volume_6h),
        volume24h: parseFloat(row.volume_24h),
        liquidityUsd: parseFloat(row.liquidity_usd),
        concentrationChange6h: parseFloat(row.concentration_change_6h),
        newWhalesCount: row.new_whales_count,
        exitedWhalesCount: row.exited_whales_count,
        accumulatingWhales: row.accumulating_whales,
        distributingWhales: row.distributing_whales,
        netWhaleFlowUsd: parseFloat(row.net_whale_flow_usd),
        riskScore: row.risk_score,
        signals: typeof row.signals === 'string' ? JSON.parse(row.signals) : row.signals,
        concerns: typeof row.concerns === 'string' ? JSON.parse(row.concerns) : row.concerns,
        positiveIndicators: typeof row.positive_indicators === 'string' ? JSON.parse(row.positive_indicators) : row.positive_indicators,
        reportJson: typeof row.report_json === 'string' ? JSON.parse(row.report_json) : row.report_json,
        reportMarkdown: row.report_markdown
      }));
    } catch (error) {
      console.error('Error fetching reports:', error);
      return [];
    }
  }
  
  /**
   * Close database connection (for graceful shutdown)
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('Database connection pool closed');
  }
}
