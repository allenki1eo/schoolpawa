import "server-only";
import Redis from "ioredis";
import { config } from "./config";

/**
 * The small slice of Redis we use: counters with TTL (rate limits) and sorted sets
 * (leaderboard cache). Falls back to an in-memory implementation when REDIS_URL is empty so
 * the app runs in dev without Redis. The ledger in Postgres stays the source of truth.
 */
export interface Kv {
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  zincrby(key: string, amount: number, member: string, ttlSeconds?: number): Promise<void>;
  /** Highest scores first, inclusive range. */
  zrevrange(key: string, start: number, stop: number): Promise<Array<{ member: string; score: number }>>;
  zrevrank(key: string, member: string): Promise<number | null>;
  zscore(key: string, member: string): Promise<number | null>;
  zcard(key: string): Promise<number>;
}

class RedisKv implements Kv {
  constructor(private r: Redis) {}
  async incrWithTtl(key: string, ttl: number) {
    const [[, n]] = (await this.r.multi().incr(key).expire(key, ttl, "NX").exec()) as [[null, number]];
    return n;
  }
  get(key: string) {
    return this.r.get(key);
  }
  async set(key: string, value: string, ttl: number) {
    await this.r.set(key, value, "EX", ttl);
  }
  async del(key: string) {
    await this.r.del(key);
  }
  async zincrby(key: string, amount: number, member: string, ttl?: number) {
    const m = this.r.multi().zincrby(key, amount, member);
    if (ttl) m.expire(key, ttl);
    await m.exec();
  }
  async zrevrange(key: string, start: number, stop: number) {
    const flat = await this.r.zrevrange(key, start, stop, "WITHSCORES");
    const out: Array<{ member: string; score: number }> = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ member: flat[i]!, score: Number(flat[i + 1]) });
    return out;
  }
  zrevrank(key: string, member: string) {
    return this.r.zrevrank(key, member);
  }
  async zscore(key: string, member: string) {
    const s = await this.r.zscore(key, member);
    return s === null ? null : Number(s);
  }
  zcard(key: string) {
    return this.r.zcard(key);
  }
}

class MemoryKv implements Kv {
  private values = new Map<string, { value: string; expires: number }>();
  private zsets = new Map<string, Map<string, number>>();

  private live(key: string) {
    const v = this.values.get(key);
    if (v && v.expires < Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return v;
  }
  async incrWithTtl(key: string, ttl: number) {
    const v = this.live(key);
    const n = (v ? Number(v.value) : 0) + 1;
    this.values.set(key, { value: String(n), expires: v?.expires ?? Date.now() + ttl * 1000 });
    return n;
  }
  async get(key: string) {
    return this.live(key)?.value ?? null;
  }
  async set(key: string, value: string, ttl: number) {
    this.values.set(key, { value, expires: Date.now() + ttl * 1000 });
  }
  async del(key: string) {
    this.values.delete(key);
    this.zsets.delete(key);
  }
  async zincrby(key: string, amount: number, member: string) {
    const z = this.zsets.get(key) ?? new Map<string, number>();
    z.set(member, (z.get(member) ?? 0) + amount);
    this.zsets.set(key, z);
  }
  private sorted(key: string) {
    return [...(this.zsets.get(key) ?? new Map()).entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))
      .map(([member, score]) => ({ member, score }));
  }
  async zrevrange(key: string, start: number, stop: number) {
    return this.sorted(key).slice(start, stop + 1);
  }
  async zrevrank(key: string, member: string) {
    const i = this.sorted(key).findIndex((e) => e.member === member);
    return i < 0 ? null : i;
  }
  async zscore(key: string, member: string) {
    return this.zsets.get(key)?.get(member) ?? null;
  }
  async zcard(key: string) {
    return this.zsets.get(key)?.size ?? 0;
  }
}

const globalForKv = globalThis as unknown as { __kv?: Kv };

function create(): Kv {
  if (!config.REDIS_URL) {
    if (config.isProd) throw new Error("REDIS_URL is required in production.");
    return new MemoryKv();
  }
  return new RedisKv(new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2, enableAutoPipelining: true }));
}

export const kv: Kv = globalForKv.__kv ?? (globalForKv.__kv = create());
