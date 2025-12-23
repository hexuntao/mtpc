import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../types.js';

/**
 * Raw query executor
 */
export class QueryExecutor {
  private db: DrizzleDB;

  constructor(db: DrizzleDB) {
    this.db = db;
  }

  /**
   * Execute raw SQL query
   */
  async execute<T = unknown>(query: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.db.execute(sql.raw(query));
    return result as T[];
  }

  /**
   * Execute in transaction
   */
  async transaction<T>(fn: (tx: DrizzleDB) => Promise<T>): Promise<T> {
    return await this.db.transaction(fn as any);
  }

  /**
   * Check database connectivity
   */
  async ping(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current timestamp from database
   */
  async now(): Promise<Date> {
    const result = await this.db.execute(sql`SELECT NOW() as now`);
    return new Date((result as any)[0].now);
  }
}

/**
 * Create query executor
 */
export function createQueryExecutor(db: DrizzleDB): QueryExecutor {
  return new QueryExecutor(db);
}
