import axios from 'axios';

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
}

interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

export interface TokenMetrics {
  tokenAddress: string;
  timestamp: Date;
  
  // Price data
  priceUsd: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  
  // Volume data
  volume5m: number;
  volume1h: number;
  volume6h: number;
  volume24h: number;
  
  // Liquidity & Market Cap
  liquidityUsd: number;
  marketCap: number;
  
  // Transaction counts
  txns5mBuys: number;
  txns5mSells: number;
  txns1hBuys: number;
  txns1hSells: number;
  txns6hBuys: number;
  txns6hSells: number;
  txns24hBuys: number;
  txns24hSells: number;
  
  // Derived metrics
  buySellRatio5m: number;
  buySellRatio1h: number;
  buySellRatio6h: number;
  buySellRatio24h: number;
}

export class DexScreenerClient {
  private baseUrl = 'https://api.dexscreener.com/latest/dex';
  private chainId = 'base';
  
  /**
   * Fetch token data from DexScreener
   */
  async fetchTokenMetrics(tokenAddress: string): Promise<TokenMetrics | null> {
    try {
      const url = `${this.baseUrl}/tokens/${tokenAddress}`;
      const response = await axios.get<DexScreenerResponse>(url);
      
      if (!response.data.pairs || response.data.pairs.length === 0) {
        console.warn(`No pairs found for token ${tokenAddress}`);
        return null;
      }
      
      // Find the Base pair with highest liquidity
      const basePairs = response.data.pairs.filter(p => p.chainId === this.chainId);
      if (basePairs.length === 0) {
        console.warn(`No Base pairs found for token ${tokenAddress}`);
        return null;
      }
      
      const pair = basePairs.sort((a, b) => b.liquidity.usd - a.liquidity.usd)[0];
      
      return this.transformPairData(pair, tokenAddress);
    } catch (error) {
      console.error(`Error fetching DexScreener data for ${tokenAddress}:`, error);
      throw error;
    }
  }
  
  /**
   * Fetch historical data for backfilling
   * Note: DexScreener doesn't provide historical API, so we'll need to use current data
   * For actual historical backfill, we'd need to either:
   * 1. Use The Graph historical queries
   * 2. Use a paid service like Defined.fi
   * 3. Scrape incrementally going forward
   */
  async fetchHistoricalData(
    tokenAddress: string,
    daysAgo: number
  ): Promise<TokenMetrics[]> {
    // For now, we'll just fetch current data
    // In production, you'd query historical sources
    console.warn('DexScreener does not provide historical API. Fetching current data only.');
    
    const current = await this.fetchTokenMetrics(tokenAddress);
    return current ? [current] : [];
  }
  
  /**
   * Transform DexScreener pair data to our TokenMetrics format
   */
  private transformPairData(pair: DexScreenerPair, tokenAddress: string): TokenMetrics {
    const buySellRatio = (buys: number, sells: number) => {
      return sells === 0 ? buys : buys / sells;
    };
    
    return {
      tokenAddress,
      timestamp: new Date(),
      
      // Price
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceChange5m: pair.priceChange.m5 || 0,
      priceChange1h: pair.priceChange.h1 || 0,
      priceChange6h: pair.priceChange.h6 || 0,
      priceChange24h: pair.priceChange.h24 || 0,
      
      // Volume
      volume5m: pair.volume.m5 || 0,
      volume1h: pair.volume.h1 || 0,
      volume6h: pair.volume.h6 || 0,
      volume24h: pair.volume.h24 || 0,
      
      // Liquidity
      liquidityUsd: pair.liquidity.usd || 0,
      marketCap: pair.marketCap || pair.fdv || 0,
      
      // Transactions
      txns5mBuys: pair.txns.m5.buys || 0,
      txns5mSells: pair.txns.m5.sells || 0,
      txns1hBuys: pair.txns.h1.buys || 0,
      txns1hSells: pair.txns.h1.sells || 0,
      txns6hBuys: pair.txns.h6.buys || 0,
      txns6hSells: pair.txns.h6.sells || 0,
      txns24hBuys: pair.txns.h24.buys || 0,
      txns24hSells: pair.txns.h24.sells || 0,
      
      // Buy/Sell ratios
      buySellRatio5m: buySellRatio(pair.txns.m5.buys, pair.txns.m5.sells),
      buySellRatio1h: buySellRatio(pair.txns.h1.buys, pair.txns.h1.sells),
      buySellRatio6h: buySellRatio(pair.txns.h6.buys, pair.txns.h6.sells),
      buySellRatio24h: buySellRatio(pair.txns.h24.buys, pair.txns.h24.sells)
    };
  }
  
  /**
   * Get chart health indicators from metrics
   */
  static analyzeChartHealth(metrics: TokenMetrics): {
    score: number;
    signals: string[];
    momentum: 'bullish' | 'bearish' | 'neutral';
  } {
    const signals: string[] = [];
    let score = 50; // Base score
    
    // Price action analysis
    if (metrics.priceChange6h > 10) {
      signals.push('Strong 6h pump (+' + metrics.priceChange6h.toFixed(2) + '%)');
      score += 15;
    } else if (metrics.priceChange6h < -10) {
      signals.push('Weak 6h price action (' + metrics.priceChange6h.toFixed(2) + '%)');
      score -= 15;
    }
    
    // Volume analysis
    if (metrics.volume6h > metrics.volume24h * 0.4) {
      signals.push('High recent volume (40%+ of 24h in last 6h)');
      score += 10;
    }
    
    // Buy/Sell pressure
    if (metrics.buySellRatio6h > 1.5) {
      signals.push('Strong buy pressure (buy/sell ratio: ' + metrics.buySellRatio6h.toFixed(2) + ')');
      score += 10;
    } else if (metrics.buySellRatio6h < 0.7) {
      signals.push('Sell pressure detected (buy/sell ratio: ' + metrics.buySellRatio6h.toFixed(2) + ')');
      score -= 10;
    }
    
    // Liquidity check
    if (metrics.liquidityUsd < 50000) {
      signals.push('Low liquidity warning (<$50k)');
      score -= 15;
    }
    
    // Determine momentum
    let momentum: 'bullish' | 'bearish' | 'neutral';
    if (score >= 60) momentum = 'bullish';
    else if (score <= 40) momentum = 'bearish';
    else momentum = 'neutral';
    
    return {
      score: Math.max(0, Math.min(100, score)),
      signals,
      momentum
    };
  }
}
