import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { DatabaseConfig, DrizzleDB } from '../types.js';

/**
 * PostgreSQL 连接管理
 * 提供数据库连接的创建和连接池管理
 *
 * **功能**：
 * - 创建数据库连接
 * - 从环境变量创建连接
 * - 连接池管理
 * - 健康检查
 */

/**
 * 创建 PostgreSQL 连接
 *
 * @param config - 数据库配置
 * @returns 数据库实例和 postgres 客户端
 *
 * **配置选项**：
 * - `connectionString` - 连接字符串
 * - `maxConnections` - 最大连接数（默认 10）
 * - `idleTimeout` - 空闲超时，秒（默认 20）
 * - `ssl` - SSL 配置
 */
export function createConnection(config: DatabaseConfig): {
  db: DrizzleDB;
  client: ReturnType<typeof postgres>;
} {
  const client = postgres(config.connectionString, {
    max: config.maxConnections ?? 10,
    idle_timeout: config.idleTimeout ?? 20,
    ssl: config.ssl,
  });

  const db = drizzle(client);

  return { db, client };
}

/**
 * 从环境变量创建连接
 * 读取 `DATABASE_URL` 环境变量创建连接
 *
 * @returns 数据库实例和 postgres 客户端
 *
 * **环境变量**：
 * - `DATABASE_URL` - 数据库连接字符串
 * - `NODE_ENV` - 用于判断是否启用 SSL（production 时启用）
 *
 * @throws {Error} 如果 DATABASE_URL 未设置
 */
export function createConnectionFromEnv(): {
  db: DrizzleDB;
  client: ReturnType<typeof postgres>;
} {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return createConnection({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

/**
 * 关闭数据库连接
 *
 * @param client - postgres 客户端
 */
export async function closeConnection(client: ReturnType<typeof postgres>): Promise<void> {
  await client.end();
}

/**
 * 连接池管理器
 * 管理数据库连接池的生命周期
 */
export class ConnectionPool {
  /** postgres 客户端 */
  private client: ReturnType<typeof postgres>;
  /** Drizzle 数据库实例 */
  private db: DrizzleDB;

  constructor(config: DatabaseConfig) {
    const { db, client } = createConnection(config);
    this.db = db;
    this.client = client;
  }

  /**
   * 获取数据库实例
   *
   * @returns Drizzle 数据库实例
   */
  getDb(): DrizzleDB {
    return this.db;
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await closeConnection(this.client);
  }

  /**
   * 健康检查
   *
   * @returns 是否健康
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 创建连接池
 *
 * @param config - 数据库配置
 * @returns 连接池实例
 */
export function createConnectionPool(config: DatabaseConfig): ConnectionPool {
  return new ConnectionPool(config);
}
