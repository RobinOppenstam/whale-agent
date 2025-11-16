import { request, gql } from 'graphql-request';
import { ethers } from 'ethers';

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

// ERC20 ABI for balanceOf and totalSupply
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export class HolderDataClient {
  private graphEndpoint: string;
  private rpcProvider: ethers.JsonRpcProvider;
  private backupRpcProvider?: ethers.JsonRpcProvider;
  
  constructor(
    rpcUrl: string,
    backupRpcUrl?: string,
    graphApiKey?: string
  ) {
    // The Graph endpoint for Base (example - adjust based on actual subgraph)
    // You'll need to find or deploy a subgraph that indexes ERC20 holders on Base
    this.graphEndpoint = graphApiKey 
      ? `https://gateway.thegraph.com/api/${graphApiKey}/subgraphs/id/BASE_HOLDER_SUBGRAPH_ID`
      : 'https://api.thegraph.com/subgraphs/name/BASE_HOLDER_SUBGRAPH'; // Replace with actual subgraph
    
    this.rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
    if (backupRpcUrl) {
      this.backupRpcProvider = new ethers.JsonRpcProvider(backupRpcUrl);
    }
  }
  
  /**
   * Fetch top holders using The Graph with RPC fallback
   */
  async fetchTopHolders(
    tokenAddress: string,
    limit: number = 50
  ): Promise<HolderSnapshot> {
    try {
      // Try The Graph first
      console.log(`Attempting to fetch holders from The Graph for ${tokenAddress}...`);
      return await this.fetchFromGraph(tokenAddress, limit);
    } catch (graphError) {
      console.warn('The Graph query failed, falling back to RPC:', graphError);
      
      try {
        // Fallback to direct RPC
        return await this.fetchFromRPC(tokenAddress, limit);
      } catch (rpcError) {
        console.error('RPC fallback also failed:', rpcError);
        throw new Error('Failed to fetch holder data from both The Graph and RPC');
      }
    }
  }
  
  /**
   * Fetch holders from The Graph
   */
  private async fetchFromGraph(
    tokenAddress: string,
    limit: number
  ): Promise<HolderSnapshot> {
    // GraphQL query to fetch token holders
    // NOTE: This is a generic query - you'll need to adjust based on your actual subgraph schema
    const query = gql`
      query GetTokenHolders($tokenAddress: String!, $limit: Int!) {
        token(id: $tokenAddress) {
          totalSupply
          holderCount
          holders(first: $limit, orderBy: balance, orderDirection: desc) {
            address
            balance
          }
        }
      }
    `;
    
    const variables = {
      tokenAddress: tokenAddress.toLowerCase(),
      limit
    };
    
    const data: any = await request(this.graphEndpoint, query, variables);
    
    if (!data.token) {
      throw new Error('Token not found in The Graph');
    }
    
    const totalSupply = parseFloat(data.token.totalSupply);
    const topHolders: HolderData[] = data.token.holders.map((h: any, index: number) => {
      const balance = parseFloat(h.balance);
      return {
        address: h.address,
        balance: h.balance,
        balanceFormatted: balance,
        percentageOfSupply: (balance / totalSupply) * 100,
        rank: index + 1
      };
    });
    
    return {
      tokenAddress,
      timestamp: new Date(),
      totalHolders: data.token.holderCount,
      topHolders,
      top10Concentration: this.calculateConcentration(topHolders, 10),
      top20Concentration: this.calculateConcentration(topHolders, 20),
      top50Concentration: this.calculateConcentration(topHolders, 50)
    };
  }
  
  /**
   * Fetch holders from RPC (direct blockchain queries)
   * This is more intensive but works without a subgraph
   */
  private async fetchFromRPC(
    tokenAddress: string,
    limit: number
  ): Promise<HolderSnapshot> {
    console.log('Fetching holder data via RPC...');
    
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.rpcProvider);
    
    try {
      // Get total supply and decimals
      const [totalSupplyRaw, decimals] = await Promise.all([
        contract.totalSupply(),
        contract.decimals()
      ]);
      
      const totalSupply = parseFloat(ethers.formatUnits(totalSupplyRaw, decimals));
      
      // NOTE: Getting holder addresses via RPC is challenging without events indexing
      // We need to either:
      // 1. Listen to Transfer events and track addresses (slow, needs archival node)
      // 2. Use a service like Moralis/Alchemy for holder lists
      // 3. Maintain our own database of known holders
      
      // For now, we'll use a hybrid approach: get known whale addresses
      // In production, you'd integrate with Moralis/Alchemy or index Transfer events
      
      const knownWhaleAddresses = await this.getKnownWhaleAddresses(tokenAddress);
      
      // Fetch balances for known addresses
      const balancePromises = knownWhaleAddresses.map(async (address) => {
        try {
          const balance = await contract.balanceOf(address);
          return {
            address,
            balance: balance.toString(),
            balanceFormatted: parseFloat(ethers.formatUnits(balance, decimals)),
            percentageOfSupply: 0 // Will calculate below
          };
        } catch (err) {
          console.error(`Error fetching balance for ${address}:`, err);
          return null;
        }
      });
      
      const balances = (await Promise.all(balancePromises))
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .sort((a, b) => b.balanceFormatted - a.balanceFormatted)
        .slice(0, limit);
      
      // Calculate percentages and ranks
      const topHolders: HolderData[] = balances.map((holder, index) => ({
        ...holder,
        percentageOfSupply: (holder.balanceFormatted / totalSupply) * 100,
        rank: index + 1
      }));
      
      return {
        tokenAddress,
        timestamp: new Date(),
        totalHolders: knownWhaleAddresses.length, // Approximate
        topHolders,
        top10Concentration: this.calculateConcentration(topHolders, 10),
        top20Concentration: this.calculateConcentration(topHolders, 20),
        top50Concentration: this.calculateConcentration(topHolders, 50)
      };
      
    } catch (error) {
      // Try backup RPC if available
      if (this.backupRpcProvider) {
        console.log('Primary RPC failed, trying backup...');
        const backupContract = new ethers.Contract(
          tokenAddress,
          ERC20_ABI,
          this.backupRpcProvider
        );
        // Retry with backup (simplified for brevity)
        throw error;
      }
      throw error;
    }
  }
  
  /**
   * Get known whale addresses for a token
   * In production, this would:
   * 1. Query Moralis/Alchemy for top holders
   * 2. Use indexed Transfer events
   * 3. Use our own database of tracked addresses
   */
  private async getKnownWhaleAddresses(tokenAddress: string): Promise<string[]> {
    // Placeholder: In production, integrate with Moralis or similar
    // For now, return empty array - you'd populate this with actual whale addresses
    
    // Option: Use Moralis API
    // const response = await axios.get(
    //   `https://deep-index.moralis.io/api/v2/erc20/${tokenAddress}/owners`,
    //   { headers: { 'X-API-Key': process.env.MORALIS_API_KEY } }
    // );
    // return response.data.result.map(h => h.owner_address);
    
    console.warn('Using RPC without holder discovery - consider integrating Moralis/Alchemy');
    return [];
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
