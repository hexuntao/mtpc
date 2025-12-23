import { toSnakeCase } from '@mtpc/shared';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../types.js';
import { TenantRepository } from './tenant-repository.js';

/**
 * 仓储工厂类
 * 管理数据库表的仓储实例创建和缓存
 *
 * **功能**：
 * - 创建和缓存仓储实例
 * - 表名映射（支持驼峰和蛇形命名）
 * - 仓储缓存清理
 */
export class RepositoryFactory {
  /** 数据库实例 */
  private db: DrizzleDB;
  /** 表名到表定义的映射 */
  private tables: Map<string, PgTable>;
  /** 仓储实例缓存 */
  private repositories: Map<string, TenantRepository<any>>;

  constructor(db: DrizzleDB, tables: Record<string, PgTable>) {
    this.db = db;
    this.tables = new Map(Object.entries(tables));
    this.repositories = new Map();
  }

  /**
   * 获取资源的仓储实例
   *
   * @param resourceName - 资源名称
   * @returns 租户仓储实例
   *
   * **命名支持**：
   * - 驼峰命名：`userProfile`
   * - 蛇形命名：`user_profile`
   */
  getRepository<T extends Record<string, unknown>>(resourceName: string): TenantRepository<T> {
    let repo = this.repositories.get(resourceName);

    if (!repo) {
      const tableName = toSnakeCase(resourceName);
      const table = this.tables.get(resourceName) ?? this.tables.get(tableName);

      if (!table) {
        throw new Error(`Table not found for resource: ${resourceName}`);
      }

      repo = new TenantRepository<T>(this.db, table, tableName);
      this.repositories.set(resourceName, repo);
    }

    return repo as TenantRepository<T>;
  }

  /**
   * 注册表定义
   *
   * @param name - 表名
   * @param table - Drizzle 表定义
   */
  registerTable(name: string, table: PgTable): void {
    this.tables.set(name, table);
  }

  /**
   * 获取所有表名
   *
   * @returns 表名数组
   */
  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  /**
   * 清空仓储缓存
   * 强制下次获取时重新创建仓储实例
   */
  clearCache(): void {
    this.repositories.clear();
  }
}

/**
 * 创建仓储工厂
 *
 * @param db - 数据库实例
 * @param tables - 表名到表定义的映射
 * @returns 仓储工厂实例
 */
export function createRepositoryFactory(
  db: DrizzleDB,
  tables: Record<string, PgTable>
): RepositoryFactory {
  return new RepositoryFactory(db, tables);
}
