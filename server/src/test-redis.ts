import 'dotenv/config';
import Redis from 'ioredis';
import { config } from './config';

// Get the Redis URL from config
const redisUrl = config.redisUrl;
console.log('Redis URL from config:', redisUrl);

// Parse Redis connection details
function parseRedisUrl(url: string) {
  try {
    // Parse Redis URL format redis://username:password@host:port/db
    const parsedUrl = new URL(url);
    const password = parsedUrl.password || 'redis';
    const host = parsedUrl.hostname || 'aeredis';
    const port = Number(parsedUrl.port) || 6379;
    const username = parsedUrl.username || 'default';
    
    return { host, port, username, password };
  } catch (error) {
    console.error(`Invalid Redis URL: ${url}. Using default connection.`);
    return {
      host: 'aeredis',
      port: 6379,
      username: 'default',
      password: 'redis',
    };
  }
}

const redisConfig = parseRedisUrl(redisUrl);
console.log('Redis connection config:', {
  host: redisConfig.host,
  port: redisConfig.port,
  username: redisConfig.username,
  password: '****' // masking password in logs
});

// Create Redis client with proper Docker container settings
const redis = new Redis(redisConfig);

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
    console.error('Redis error:', (error as Error).message);
  } finally {
    redis.quit();
  }
}

testConnection(); 