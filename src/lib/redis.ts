import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  // Find the correct REST URL (must start with https://)
  const allEnvKeys = Object.keys(process.env);
  const urlKey = allEnvKeys.find(
    (k) => k.includes('UPSTASH') && k.endsWith('_URL') && process.env[k]?.startsWith('https')
  );
  const tokenKey = allEnvKeys.find(
    (k) => k.includes('UPSTASH') && k.includes('TOKEN') && !k.includes('READ_ONLY')
  );

  const url = urlKey ? process.env[urlKey] : undefined;
  const token = tokenKey ? process.env[tokenKey] : undefined;

  if (!url || !token) {
    console.warn('Upstash Redis not configured. Available UPSTASH keys:', allEnvKeys.filter(k => k.includes('UPSTASH')));
    return null;
  }
  if (!redis) {
    redis = new Redis({ url, token });
  }
  return redis;
}
