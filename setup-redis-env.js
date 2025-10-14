#!/usr/bin/env node

/**
 * Redis Environment Setup Script
 * Helps configure Upstash Redis for the chat application
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Redis environment configuration...\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
const envExists = fs.existsSync(envPath);

let envContent = '';
if (envExists) {
  envContent = fs.readFileSync(envPath, 'utf8');
  console.log('✅ Found existing .env.local file');
} else {
  console.log('📝 Creating new .env.local file');
}

// Check if Redis configuration already exists
const hasRedisUrl = envContent.includes('REDIS_URL=');
const hasRedisHost = envContent.includes('REDIS_HOST=');

if (hasRedisUrl || hasRedisHost) {
  console.log('⚠️  Redis configuration already exists in .env.local');
  console.log('   Current Redis config:');
  if (hasRedisUrl) {
    const redisUrlMatch = envContent.match(/REDIS_URL=(.+)/);
    if (redisUrlMatch) {
      console.log(`   REDIS_URL=${redisUrlMatch[1].substring(0, 20)}...`);
    }
  }
  if (hasRedisHost) {
    const redisHostMatch = envContent.match(/REDIS_HOST=(.+)/);
    if (redisHostMatch) {
      console.log(`   REDIS_HOST=${redisHostMatch[1]}`);
    }
  }
  console.log('\n   If you want to update it, please edit .env.local manually.\n');
} else {
  // Add Redis configuration template
  const redisConfig = `
# Redis Configuration (Upstash)
# Option 1: Redis URL format (recommended)
REDIS_URL=rediss://default:your-password@your-endpoint.upstash.io:6380

# Option 2: Individual credentials (alternative)
# UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-token-here
`;

  const newEnvContent = envContent + redisConfig;
  fs.writeFileSync(envPath, newEnvContent);
  
  console.log('✅ Added Redis configuration template to .env.local');
  console.log('\n📋 Next steps:');
  console.log('1. Go to https://console.upstash.com/');
  console.log('2. Create a new Redis database');
  console.log('3. Copy the Redis URL from your database');
  console.log('4. Replace the placeholder in .env.local with your actual Redis URL');
  console.log('   - REDIS_URL=rediss://default:your-password@your-endpoint.upstash.io:6380');
  console.log('\n💡 The application will fall back to memory cache if Redis is not available.');
}

console.log('\n🎯 Upstash Free Tier Capacity:');
console.log('   ✅ 10,000 requests/day (sufficient for 100+ users)');
console.log('   ✅ 256MB memory (sufficient for chat data)');
console.log('   ✅ 30 concurrent connections');
console.log('   ⚠️  No data persistence (data expires after 24h inactivity)');

console.log('\n🚀 Performance optimizations included:');
console.log('   • Redis caching with compression');
console.log('   • Memory cache fallback');
console.log('   • Smart cache invalidation');
console.log('   • Performance monitoring');

console.log('\n✨ Setup complete! Restart your server to apply changes.');
