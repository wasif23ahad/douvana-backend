import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

let redisInstance: Redis | null = null;

if (redisUrl) {
  redisInstance = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redisInstance.on('error', (error) => {
    console.error('Redis error:', error.message);
  });

  redisInstance.on('connect', () => {
    console.log('Connected to Redis');
  });
}

// Null-safe wrapper so callers don't crash when Redis is unavailable
export const redis = {
  get: async (key: string): Promise<string | null> => {
    if (!redisInstance) return null;
    try { return await redisInstance.get(key); } catch { return null; }
  },
  setex: async (key: string, ttl: number, value: string): Promise<void> => {
    if (!redisInstance) return;
    try { await redisInstance.setex(key, ttl, value); } catch { /* no-op */ }
  },
  del: async (key: string): Promise<void> => {
    if (!redisInstance) return;
    try { await redisInstance.del(key); } catch { /* no-op */ }
  },
  // Expose raw client for BullMQ (requires real Redis)
  raw: redisInstance,
};

export default redis;