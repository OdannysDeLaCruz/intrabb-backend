import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
      const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
      const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

      this.client = createClient({
        socket: {
          host: redisHost,
          port: redisPort,
        },
        password: redisPassword || undefined,
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis Client Error', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        this.logger.log('Redis Client Reconnecting');
      });

      this.client.on('ready', () => {
        this.logger.log('Redis Client Ready');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      this.isConnected = false;
    }
  }

  private async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // async isConnected(): Promise<boolean> {
  //   return this.isConnected;
  // }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to set key ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}`, error);
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Failed to get keys with pattern ${pattern}`, error);
      return [];
    }
  }

  async flush(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.flushDb();
    } catch (error) {
      this.logger.error('Failed to flush cache', error);
    }
  }

  // Search-specific cache methods
  generateSearchKey(query: string, categoryId?: string, limit?: number, offset?: number): string {
    const parts = ['search'];
    if (query) parts.push(`q:${query}`);
    if (categoryId) parts.push(`cat:${categoryId}`);
    if (limit) parts.push(`limit:${limit}`);
    if (offset) parts.push(`offset:${offset}`);
    return parts.join(':');
  }

  generatePopularKey(limit: number): string {
    return `popular:${limit}`;
  }

  generateSuggestionsKey(query: string, limit: number): string {
    return `suggestions:${query}:${limit}`;
  }

  async invalidateSearchCache(): Promise<void> {
    const keys = await this.keys('search:*');
    if (keys.length > 0) {
      await Promise.all(keys.map(key => this.del(key)));
    }
  }

  async invalidatePopularCache(): Promise<void> {
    const keys = await this.keys('popular:*');
    if (keys.length > 0) {
      await Promise.all(keys.map(key => this.del(key)));
    }
  }

  async invalidateSuggestionsCache(): Promise<void> {
    const keys = await this.keys('suggestions:*');
    if (keys.length > 0) {
      await Promise.all(keys.map(key => this.del(key)));
    }
  }

  async invalidateAllSearchCaches(): Promise<void> {
    await Promise.all([
      this.invalidateSearchCache(),
      this.invalidatePopularCache(),
      this.invalidateSuggestionsCache(),
    ]);
  }
}