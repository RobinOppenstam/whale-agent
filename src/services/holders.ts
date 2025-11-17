export interface HolderData {
  address: string;
  balance: string; // Raw balance as string
  balanceFormatted: number;
  percentageOfSupply: number;
  rank: number;
}

export interface HolderSnapshot {
  tokenAddress: string;
  timestamp: Date;
  totalHolders: number;
  topHolders: HolderData[];
  top10Concentration: number;
  top20Concentration: number;
  top50Concentration: number;
}

export interface WhaleTransaction {
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
  from: string;
  to: string;
  value: string; // Raw value
  valueFormatted: number;
  percentageOfSupply: number;
  type: 'buy' | 'sell' | 'transfer';
  method?: string;
}

export class HolderDataClient {
  constructor(
    rpcUrl?: string,       // Kept for backward compatibility but unused
    backupRpcUrl?: string, // Kept for backward compatibility but unused
    graphApiKey?: string   // Kept for backward compatibility but unused
  ) {
    console.log(`🔧 Initializing HolderDataClient - Using Blockscout API only`);
  }
  
  /**
   * Fetch top holders using Blockscout API
   * This is the primary and only data source for holder information
   */
  async fetchTopHolders(
    tokenAddress: string,
    limit: number = 50
  ): Promise<HolderSnapshot> {
    console.log(`\n📊 Fetching top ${limit} holders for ${tokenAddress}...`);

    try {
      const snapshot = await this.fetchFromBlockscout(tokenAddress, limit);
      console.log(`✅ Successfully fetched holder data for ${tokenAddress}`);
      console.log(`   - Total holders: ${snapshot.totalHolders}`);
      console.log(`   - Top 10 concentration: ${snapshot.top10Concentration}%`);
      console.log(`   - Top 20 concentration: ${snapshot.top20Concentration}%`);
      console.log(`   - Top 50 concentration: ${snapshot.top50Concentration}%\n`);
      return snapshot;
    } catch (error: any) {
      console.error(`❌ Failed to fetch holder data from Blockscout: ${error.message}`);
      throw new Error(`Failed to fetch holder data: ${error.message}`);
    }
  }

  /**
   * Fetch holders from Blockscout API (Base Chain Explorer)
   * Free API, no key required
   */
  private async fetchFromBlockscout(
    tokenAddress: string,
    limit: number
  ): Promise<HolderSnapshot> {
    const axios = await import('axios');
    const baseUrl = `https://base.blockscout.com/api/v2/tokens/${tokenAddress}`;

    try {
      // Fetch token info and holders in parallel
      console.log(`🔍 Fetching token info and holders from Blockscout...`);
      const [tokenInfoResponse, holdersResponse] = await Promise.all([
        axios.default.get(baseUrl, { timeout: 15000 }),
        axios.default.get(`${baseUrl}/holders`, {
          params: { items_count: limit },
          timeout: 15000
        })
      ]);

      console.log(`✅ Blockscout responses received`);
      console.log(`   - Token info: ${tokenInfoResponse.status}`);
      console.log(`   - Holders: ${holdersResponse.status}, items: ${holdersResponse.data?.items?.length || 0}`);

      // Extract token info from Blockscout
      const tokenInfo = tokenInfoResponse.data;
      const decimals = parseInt(tokenInfo.decimals);
      const totalSupplyRaw = tokenInfo.total_supply;
      const holdersCount = parseInt(tokenInfo.holders_count || '0');

      console.log(`📊 Token Info from Blockscout:`);
      console.log(`   - Symbol: ${tokenInfo.symbol}`);
      console.log(`   - Decimals: ${decimals}`);
      console.log(`   - Total Supply (raw): ${totalSupplyRaw}`);
      console.log(`   - Total Holders: ${holdersCount}`);

      // Validate holders response
      if (!holdersResponse.data || !holdersResponse.data.items) {
        throw new Error(`Invalid holders response from Blockscout API`);
      }

      const holders = holdersResponse.data.items;
      console.log(`✅ Blockscout returned ${holders.length} holders`);

      // Calculate total supply in human-readable format
      const totalSupply = parseFloat(totalSupplyRaw) / Math.pow(10, decimals);
      console.log(`   - Total Supply (formatted): ${totalSupply.toLocaleString()}`);

      // Convert holder data from Blockscout format
      console.log(`🔄 Processing ${holders.length} holders...`);
      const topHolders: HolderData[] = holders.slice(0, limit).map((h: any, index: number) => {
        // Handle BigInt values - convert to string first
        const balanceStr = typeof h.value === 'bigint' ? h.value.toString() : String(h.value);
        const balanceFormatted = parseFloat(balanceStr) / Math.pow(10, decimals);
        const percentageOfSupply = (balanceFormatted / totalSupply) * 100;

        return {
          address: h.address.hash,
          balance: balanceStr,
          balanceFormatted,
          percentageOfSupply,
          rank: index + 1
        };
      });
      console.log(`✅ Processed ${topHolders.length} holders`);

      // Calculate concentrations
      const top10 = this.calculateConcentration(topHolders, 10);
      const top20 = this.calculateConcentration(topHolders, 20);
      const top50 = this.calculateConcentration(topHolders, 50);

      console.log(`📊 Concentration calculated:`);
      console.log(`   - Top 10: ${top10}%`);
      console.log(`   - Top 20: ${top20}%`);
      console.log(`   - Top 50: ${top50}%`);

      return {
        tokenAddress,
        timestamp: new Date(),
        totalHolders: holdersCount,
        topHolders,
        top10Concentration: top10,
        top20Concentration: top20,
        top50Concentration: top50
      };
    } catch (error: any) {
      console.error(`❌ Blockscout API error:`, error.message);
      if (error.response) {
        console.error(`   - Status: ${error.response.status}`);
        console.error(`   - Data:`, error.response.data);
      }
      throw new Error(`Blockscout API error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch recent whale transactions from Blockscout
   * Only returns transactions above the whale threshold (default 1% of supply)
   */
  async fetchWhaleTransactions(
    tokenAddress: string,
    hoursBack: number = 6,
    whaleThresholdPercent: number = 1.0
  ): Promise<WhaleTransaction[]> {
    const axios = await import('axios');
    const baseUrl = `https://base.blockscout.com/api/v2/tokens/${tokenAddress}`;

    try {
      console.log(`\n🐋 Fetching whale transactions from last ${hoursBack} hours...`);

      // First, get token info for total supply
      const tokenInfoResponse = await axios.default.get(baseUrl, { timeout: 15000 });
      const tokenInfo = tokenInfoResponse.data;
      const decimals = parseInt(tokenInfo.decimals);
      const totalSupplyRaw = tokenInfo.total_supply;
      const totalSupply = parseFloat(totalSupplyRaw) / Math.pow(10, decimals);

      console.log(`📊 Total Supply: ${totalSupply.toLocaleString()}`);
      console.log(`🎯 Whale threshold: ${whaleThresholdPercent}% = ${(totalSupply * whaleThresholdPercent / 100).toLocaleString()} tokens`);

      // Fetch recent transfers
      const transfersResponse = await axios.default.get(`${baseUrl}/transfers`, {
        timeout: 15000
      });

      if (!transfersResponse.data || !transfersResponse.data.items) {
        throw new Error('Invalid transfers response from Blockscout');
      }

      const transfers = transfersResponse.data.items;
      console.log(`📥 Fetched ${transfers.length} recent transfers`);

      // Calculate cutoff time
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      // Filter and process whale transactions
      const whaleTransactions: WhaleTransaction[] = [];

      for (const transfer of transfers) {
        const timestamp = new Date(transfer.timestamp);

        // Skip if outside time window
        if (timestamp < cutoffTime) continue;

        // Calculate token amount
        const valueRaw = transfer.total?.value || '0';
        const valueFormatted = parseFloat(valueRaw) / Math.pow(10, decimals);
        const percentageOfSupply = (valueFormatted / totalSupply) * 100;

        // Only include if above whale threshold
        if (percentageOfSupply < whaleThresholdPercent) continue;

        // Determine transaction type (simplified)
        let txType: 'buy' | 'sell' | 'transfer' = 'transfer';
        const fromAddr = transfer.from?.hash?.toLowerCase() || '';
        const toAddr = transfer.to?.hash?.toLowerCase() || '';

        // Common DEX pool addresses on Base (you can expand this)
        const dexPools = [
          '0x8ffd336d457ada04a2d5112f8f0c1f1a84577f2f', // Uniswap WIRE/VIRTUAL pool
          '0xc7254af5152f875651790667ec65e760461db3d5'  // Aerodrome pool
        ];

        if (dexPools.includes(fromAddr)) {
          txType = 'buy';
        } else if (dexPools.includes(toAddr)) {
          txType = 'sell';
        }

        whaleTransactions.push({
          transactionHash: transfer.transaction_hash,
          blockNumber: transfer.block_number,
          timestamp,
          from: transfer.from?.hash || '',
          to: transfer.to?.hash || '',
          value: valueRaw,
          valueFormatted,
          percentageOfSupply,
          type: txType,
          method: transfer.method
        });
      }

      console.log(`✅ Found ${whaleTransactions.length} whale transactions (>${whaleThresholdPercent}% of supply)`);

      // Sort by value descending
      whaleTransactions.sort((a, b) => b.valueFormatted - a.valueFormatted);

      // Log top 5 whale transactions
      if (whaleTransactions.length > 0) {
        console.log(`\n📊 Top whale transactions:`);
        whaleTransactions.slice(0, 5).forEach((tx, i) => {
          console.log(`   ${i + 1}. ${tx.type.toUpperCase()} - ${tx.percentageOfSupply.toFixed(2)}% (${tx.valueFormatted.toLocaleString()} tokens)`);
          console.log(`      Hash: ${tx.transactionHash.substring(0, 20)}...`);
        });
      }

      return whaleTransactions;

    } catch (error: any) {
      console.error(`❌ Failed to fetch whale transactions:`, error.message);
      if (error.response) {
        console.error(`   - Status: ${error.response.status}`);
      }
      // Return empty array instead of throwing - whale transactions are optional
      return [];
    }
  }

  /**
   * Calculate concentration percentage for top N holders
   */
  private calculateConcentration(holders: HolderData[], topN: number): number {
    const concentration = holders
      .slice(0, topN)
      .reduce((sum, h) => sum + h.percentageOfSupply, 0);

    return Math.round(concentration * 100) / 100;
  }
  
  /**
   * Detect new and exited whales by comparing snapshots
   */
  static compareSnapshots(
    previous: HolderSnapshot,
    current: HolderSnapshot
  ): {
    newWhales: HolderData[];
    exitedWhales: HolderData[];
    changes: Array<{
      address: string;
      oldRank: number;
      newRank: number;
      balanceChange: number;
      percentageChange: number;
    }>;
  } {
    const prevMap = new Map(previous.topHolders.map(h => [h.address, h]));
    const currMap = new Map(current.topHolders.map(h => [h.address, h]));
    
    // Find new whales
    const newWhales = current.topHolders.filter(h => !prevMap.has(h.address));
    
    // Find exited whales
    const exitedWhales = previous.topHolders.filter(h => !currMap.has(h.address));
    
    // Find changes
    const changes = current.topHolders
      .filter(curr => prevMap.has(curr.address))
      .map(curr => {
        const prev = prevMap.get(curr.address)!;
        const balanceChange = curr.balanceFormatted - prev.balanceFormatted;
        const percentageChange = (balanceChange / prev.balanceFormatted) * 100;
        
        return {
          address: curr.address,
          oldRank: prev.rank,
          newRank: curr.rank,
          balanceChange,
          percentageChange
        };
      })
      .filter(c => Math.abs(c.percentageChange) > 1) // Only significant changes
      .sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange));
    
    return { newWhales, exitedWhales, changes };
  }
}
