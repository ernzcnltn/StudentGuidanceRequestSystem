const Redis = require('ioredis');

const isDevelopment = process.env.NODE_ENV !== 'production';
const useRedis = process.env.USE_REDIS === 'true';

let redisClient = null;

// Production'da Redis ZORUNLU, Development'ta opsiyonel
if (useRedis || !isDevelopment) {
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        if (isDevelopment && times > 3) {
          console.warn('⚠️ Redis connection failed, using in-memory storage');
          return null; // Stop retrying in dev
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
      if (!isDevelopment) {
        throw new Error('Redis connection failed in production');
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
  } catch (error) {
    if (!isDevelopment) {
      throw error; // Production'da hata fırlat
    }
    console.warn('⚠️ Redis not available, using in-memory storage (dev only)');
  }
}

module.exports = redisClient;