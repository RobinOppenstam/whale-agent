import dotenv from 'dotenv';
import { GameAgent } from './game-agent.js';
import { TokenConfig } from './scheduler.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'BASE_RPC_URL',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'TOKENS'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease check your .env file or Railway environment variables');
    process.exit(1);
  }
}

// Parse token configuration
function parseTokens(): TokenConfig[] {
  const tokensStr = process.env.TOKENS || '';
  const addresses = tokensStr.split(',').map(t => t.trim());
  
  // Map addresses to symbols (you can extend this)
  const tokenMap: { [key: string]: string } = {
    '0x0b3AE50BaBE7FFa4E1A50569ceE6bDEFd4ccAeE0': 'WIRE',
    '0x1C4CcA7C5DB003824208aDDA61Bd749e55F463a3': 'GAME'
  };
  
  return addresses
    .filter(addr => addr.length > 0)
    .map(address => ({
      address,
      symbol: tokenMap[address] || 'UNKNOWN'
    }));
}

async function main() {
  try {
    // Validate environment
    validateEnv();
    
    // Parse configuration
    const tokens = parseTokens();
    const cronSchedule = process.env.ANALYSIS_SCHEDULE || '0 */6 * * *';
    
    console.log('\n🎮 Starting Whale Agent (G.A.M.E)...\n');
    console.log('Configuration:');
    console.log(`- Database: ${process.env.DATABASE_URL?.split('@')[1] || 'Railway PostgreSQL'}`);
    console.log(`- RPC: ${process.env.BASE_RPC_URL}`);
    console.log(`- Tokens: ${tokens.map(t => t.symbol).join(', ')}`);
    console.log(`- Schedule: ${cronSchedule}`);
    console.log(`- Telegram: ${process.env.TELEGRAM_CHAT_ID ? 'Enabled' : 'Disabled'}\n`);
    
    // Initialize agent
    const agent = new GameAgent(
      process.env.BASE_RPC_URL!,
      process.env.BASE_RPC_BACKUP || 'https://mainnet.base.org',
      process.env.DATABASE_URL!,
      tokens,
      cronSchedule,
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_CHAT_ID,
      process.env.GRAPH_API_KEY
    );
    
    // Start the agent
    await agent.initialize();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n📡 Received SIGINT signal');
      agent.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n\n📡 Received SIGTERM signal');
      agent.shutdown();
      process.exit(0);
    });
    
    // Keep process alive
    console.log('🔄 Agent running... Press Ctrl+C to stop\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the agent
main();
