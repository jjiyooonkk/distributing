import { customAlphabet } from 'nanoid';
import { getRedis } from './redis';
import type { Project } from '@/types';

const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const PROJECT_TTL = 30 * 24 * 60 * 60; // 30 days

function projectKey(code: string) {
  return `project:${code.toUpperCase()}`;
}

// In-memory fallback when Redis is not configured
const memoryStore = new Map<string, { data: string; expiresAt: number }>();

async function memGet(key: string): Promise<string | null> {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.data;
}

async function memSet(key: string, value: string, ttl: number) {
  memoryStore.set(key, { data: value, expiresAt: Date.now() + ttl * 1000 });
}

async function memDel(key: string) {
  memoryStore.delete(key);
}

async function memTtl(key: string): Promise<number> {
  const entry = memoryStore.get(key);
  if (!entry) return -2;
  return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
}

export async function createProject(name: string): Promise<Project> {
  const code = generateCode();
  const now = new Date().toISOString();
  const project: Project = {
    code,
    name,
    createdAt: now,
    expiresAt: new Date(Date.now() + PROJECT_TTL * 1000).toISOString(),
    status: 'active',
    data: [],
    columns: [],
    config: null,
    results: null,
  };

  const redis = getRedis();
  const json = JSON.stringify(project);
  if (redis) {
    await redis.set(projectKey(code), json, { ex: PROJECT_TTL });
  } else {
    await memSet(projectKey(code), json, PROJECT_TTL);
  }
  return project;
}

export async function getProject(code: string): Promise<Project | null> {
  const redis = getRedis();
  let raw: string | null;
  if (redis) {
    const result = await redis.get<string>(projectKey(code));
    raw = result ?? null;
  } else {
    raw = await memGet(projectKey(code));
  }
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as Project;
}

export async function updateProject(code: string, updates: Partial<Project>): Promise<Project | null> {
  const existing = await getProject(code);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  const json = JSON.stringify(updated);

  const redis = getRedis();
  if (redis) {
    const ttl = await redis.ttl(projectKey(code));
    await redis.set(projectKey(code), json, { ex: ttl > 0 ? ttl : PROJECT_TTL });
  } else {
    const ttl = await memTtl(projectKey(code));
    await memSet(projectKey(code), json, ttl > 0 ? ttl : PROJECT_TTL);
  }
  return updated;
}

export async function deleteProject(code: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const deleted = await redis.del(projectKey(code));
    return deleted > 0;
  } else {
    memDel(projectKey(code));
    return true;
  }
}
