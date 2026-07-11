import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const useTls = this.config.get<string>('REDIS_TLS') === 'true';
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD'),
      lazyConnect: true,
      ...(useTls ? { tls: {} } : {})
    });
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  async zrank(key: string, member: string): Promise<number | null> {
    return this.client.zrank(key, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }

  async zrangeWithScores(key: string, start: number, stop: number): Promise<{ member: string; score: number }[]> {
    const result = await this.client.zrange(key, start, stop, 'WITHSCORES');
    const out: { member: string; score: number }[] = [];
    for (let i = 0; i < result.length; i += 2) {
      out.push({ member: result[i], score: parseFloat(result[i + 1]) });
    }
    return out;
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.client.zrem(key, member);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async zscore(key: string, member: string): Promise<string | null> {
    return this.client.zscore(key, member);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }
}
