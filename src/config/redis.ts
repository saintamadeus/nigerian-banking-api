import { createClient } from 'redis';

const redisClient = process.env.REDIS_URL
  ? createClient({
      url: process.env.REDIS_URL,
      RESP: 2,
    })
  : createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
      RESP: 2,
    });

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis connected');
});

export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export default redisClient;