import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
    || process.env.UPSTASH_REDIS_REST_KV_URL
    || process.env.UPSTASH_REDIS_REST_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN
    || process.env.UPSTASH_REDIS_REST_KV_REST_API_READ_ONLY_TOKEN;

  if (!url || !token) {
    return null;
  }
  if (!redis) {
    redis = new Redis({ url, token });
  }
  return redis;
}
