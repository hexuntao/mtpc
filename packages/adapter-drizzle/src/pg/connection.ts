import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { DatabaseConfig, DrizzleDB } from '../types.js';

/**
 * Create PostgreSQL connection
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
 * Create connection from environment
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
 * Close connection
 */
export async function closeConnection(client: ReturnType<typeof postgres>): Promise<void> {
  await client.end();
}

/**
 * Connection pool manager
 */
export class ConnectionPool {
  private client: ReturnType<typeof postgres>;
  private db: DrizzleDB;

  constructor(config: DatabaseConfig) {
    const { db, client } = createConnection(config);
    this.db = db;
    this.client = client;
  }

  getDb(): DrizzleDB {
    return this.db;
  }

  async close(): Promise<void> {
    await closeConnection(this.client);
  }

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
 * Create connection pool
 */
export function createConnectionPool(config: DatabaseConfig): ConnectionPool {
  return new ConnectionPool(config);
}
