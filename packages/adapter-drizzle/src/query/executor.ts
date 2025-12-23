import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '../types.js';

/**
 * 原始 SQL 查询执行器
 * 用于执行原生 SQL 查询和事务
 *
 * **功能**：
 * - 执行原始 SQL 查询
 * - 事务管理
 * - 数据库连接检测
 * - 获取数据库时间
 */
export class QueryExecutor {
  /** 数据库实例 */
  private db: DrizzleDB;

  constructor(db: DrizzleDB) {
    this.db = db;
  }

  /**
   * 执行原始 SQL 查询
   *
   * @param query - SQL 查询语句
   * @param _params - 查询参数（预留）
   * @returns 查询结果
   */
  async execute<T = unknown>(query: string, _params: unknown[] = []): Promise<T[]> {
    const result = await this.db.execute(sql.raw(query));
    return result as T[];
  }

  /**
   * 在事务中执行操作
   *
   * @param fn - 事务中执行的函数
   * @returns 函数执行结果
   *
   * **示例**：
   * ```ts
   * const result = await executor.transaction(async (tx) => {
   *   await tx.execute(sql.raw('INSERT INTO ...'));
   *   await tx.execute(sql.raw('UPDATE ...'));
   *   return 'success';
   * });
   * ```
   */
  async transaction<T>(fn: (tx: DrizzleDB) => Promise<T>): Promise<T> {
    return await this.db.transaction(fn as any);
  }

  /**
   * 检查数据库连接
   *
   * @returns 是否连接成功
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
   * 获取数据库当前时间
   *
   * @returns 数据库时间
   */
  async now(): Promise<Date> {
    const result = await this.db.execute(sql`SELECT NOW() as now`);
    return new Date((result as any)[0].now);
  }
}

/**
 * 创建查询执行器
 *
 * @param db - 数据库实例
 * @returns 查询执行器实例
 */
export function createQueryExecutor(db: DrizzleDB): QueryExecutor {
  return new QueryExecutor(db);
}
