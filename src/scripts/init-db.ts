import dotenv from 'dotenv';
import { DatabaseService } from '../services/database.js';

dotenv.config();

async function initializeDatabase() {
  console.log('🔧 Initializing Railway database schema...\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found');
    console.error('Make sure you have:');
    console.error('1. Provisioned PostgreSQL in Railway');
    console.error('2. DATABASE_URL is in your environment variables');
    process.exit(1);
  }
  
  try {
    const db = new DatabaseService(process.env.DATABASE_URL);
    
    // Test connection
    console.log('📡 Testing database connection...');
    const connected = await db.testConnection();
    
    if (!connected) {
      throw new Error('Failed to connect to database');
    }
    
    // Initialize schema
    console.log('\n📊 Creating tables and indexes...');
    await db.initializeSchema();
    
    console.log('\n✅ Database initialization complete!');
    console.log('\nTables created:');
    console.log('  - token_snapshots');
    console.log('  - whale_positions');
    console.log('  - whale_transactions');
    console.log('  - whale_reports');
    console.log('\nYou can now run the agent with: npm start');
    
    await db.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check that DATABASE_URL is correct');
    console.error('2. Ensure PostgreSQL is provisioned in Railway');
    console.error('3. Check database/schema.sql for syntax errors');
    process.exit(1);
  }
}

initializeDatabase();
