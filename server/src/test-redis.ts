import 'dotenv/config';
import Redis from 'ioredis';

// Get the Redis URL from environment
const redisUrl = process.env.REDIS_URL;
console.log('Redis URL from env:', redisUrl);

// Create Redis client explicitly
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  username: 'default',
  password: 'redis'
});

// Test connection
async function testConnection() {
  try {
    console.log('Testing Redis connection...');
    const result = await redis.ping();
    console.log('Redis ping response:', result);
    
    console.log('Testing Redis publish...');
    const publishResult = await redis.publish('test', 'Hello Redis');
    console.log('Publish result:', publishResult);
    
    console.log('Redis connection and publish successful!');
  } catch (error) {
    console.error('Redis error:', error);
  } finally {
    redis.quit();
  }
}

testConnection(); 