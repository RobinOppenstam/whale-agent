import dotenv from 'dotenv';
import { DexScreenerClient } from '../services/dexscreener.js';
import { DatabaseService } from '../services/database.js';

dotenv.config();

/**
 * Backfill script to populate historical data
 * Note: DexScreener doesn't provide historical API, so we'll create initial snapshots
 * For true historical backfill, you'd need to use The Graph historical queries
 */

async function backfill() {
  console.log('🔄 Starting data backfill process...\n');
  
  // Validate environment
  if (!process.env.DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL configuration');
    console.error('Railway should inject this automatically when database is provisioned');
    process.exit(1);
  }
  
  const database = new DatabaseService(process.env.DATABASE_URL);
  
  const dexscreener = new DexScreenerClient();
  
  // Parse tokens
  const tokensStr = process.env.TOKENS || '';
  const tokenAddresses = tokensStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  const tokenMap: { [key: string]: string } = {
    '0x0b3AE50BaBE7FFa4E1A50569ceE6bDEFd4ccAeE0': 'WIRE',
    '0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3': 'GAME'
  };
  
  console.log(`📊 Backfilling data for ${tokenAddresses.length} token(s):`);
  tokenAddresses.forEach(addr => {
    console.log(`   - ${tokenMap[addr] || 'UNKNOWN'} (${addr})`);
  });
  console.log();
  
  const backfillDays = parseInt(process.env.BACKFILL_DAYS || '30');
  console.log(`📅 Attempting to backfill ${backfillDays} days of data\n`);
  
  for (const tokenAddress of tokenAddresses) {
    const symbol = tokenMap[tokenAddress] || 'UNKNOWN';
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing ${symbol}...`);
    console.log('='.repeat(60));
    
    try {
      // Fetch current snapshot
      console.log('📊 Fetching current data from DexScreener...');
      const metrics = await dexscreener.fetchTokenMetrics(tokenAddress);
      
      if (!metrics) {
        console.error(`❌ Failed to fetch data for ${symbol}`);
        continue;
      }
      
      // Store current snapshot
      console.log('💾 Storing current snapshot...');
      await database.storeTokenSnapshot(metrics);
      console.log('✅ Current snapshot stored');
      
      // Note: For historical data, you would:
      // 1. Query The Graph for historical holder snapshots
      // 2. Query historical price/volume data from a paid service
      // 3. Generate snapshots at 30-min intervals going back
      
      console.log('\n⚠️  Historical data backfill requires:');
      console.log('   1. The Graph historical queries for holder data');
      console.log('   2. Historical price data (Defined.fi, CoinGecko, etc.)');
      console.log('   3. Custom implementation based on your data sources\n');
      
      console.log('💡 For now, we\'ve stored the current snapshot.');
      console.log('   The agent will build historical data going forward.');
      
      // Small delay to avoid rate limits
      await delay(2000);
      
    } catch (error) {
      console.error(`❌ Error processing ${symbol}:`, error);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Backfill process complete');
  console.log('='.repeat(60));
  console.log('\n💡 Tips:');
  console.log('   - Historical data will accumulate as the agent runs');
  console.log('   - First reports may lack trend data (6h, 24h, 7d changes)');
  console.log('   - After 24 hours of running, you\'ll have full trend analysis');
  console.log('   - Consider running continuous 30-min snapshots for best results\n');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run backfill
backfill().catch(error => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
