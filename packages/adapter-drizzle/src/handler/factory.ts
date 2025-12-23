import type { ResourceDefinition } from '@mtpc/core';
import { toSnakeCase } from '@mtpc/shared';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../types.js';
import { DrizzleCRUDHandler } from './crud-handler.js';

/**
 * Drizzle 处理器工厂
 * 为 MTPC 资源创建和管理 CRUD 处理器
 *
 * **功能**：
 * - 创建资源的 CRUD 处理器
 * - 处理器缓存
 * - 表名映射
 */
export class DrizzleHandlerFactory {
  /** 数据库实例 */
  private db: DrizzleDB;
  /** 表名到表定义的映射 */
  private tables: Map<string, PgTable>;
  /** 处理器缓存 */
  private handlers: Map<string, DrizzleCRUDHandler<any>>;

  constructor(db: DrizzleDB, tables: Record<string, PgTable>) {
    this.db = db;
    this.tables = new Map(Object.entries(tables));
    this.handlers = new Map();
  }

  /**
   * 为资源创建处理器
   *
   * @param resource - 资源定义
   * @returns CRUD 处理器实例
   */
  createHandler<T extends Record<string, unknown>>(
    resource: ResourceDefinition
  ): DrizzleCRUDHandler<T> {
    const cached = this.handlers.get(resource.name);
    if (cached) {
      return cached as DrizzleCRUDHandler<T>;
    }

    const tableName = toSnakeCase(resource.name);
    const table = this.tables.get(resource.name) ?? this.tables.get(tableName);

    if (!table) {
      throw new Error(`Table not found for resource: ${resource.name}`);
    }

    const handler = new DrizzleCRUDHandler<T>(this.db, table, resource);
    this.handlers.set(resource.name, handler);

    return handler;
  }

  /**
   * 获取用于 Hono 适配器的工厂函数
   *
   * @returns 工厂函数
   */
  getHandlerFactoryFn() {
    return (resource: ResourceDefinition) => this.createHandler(resource);
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
   * 清空处理器缓存
   * 强制下次获取时重新创建处理器
   */
  clearCache(): void {
    this.handlers.clear();
  }
}

/**
 * 创建 Drizzle 处理器工厂
 *
 * @param db - 数据库实例
 * @param tables - 表名到表定义的映射
 * @returns 处理器工厂实例
 */
export function createDrizzleHandlerFactory(
  db: DrizzleDB,
  tables: Record<string, PgTable>
): DrizzleHandlerFactory {
  return new DrizzleHandlerFactory(db, tables);
}

/**
 * 创建用于 Hono 的处理器工厂函数
 *
 * @param db - 数据库实例
 * @param tables - 表名到表定义的映射
 * @returns 工厂函数
 */
export function createHandlerFactory(db: DrizzleDB, tables: Record<string, PgTable>) {
  const factory = new DrizzleHandlerFactory(db, tables);
  return factory.getHandlerFactoryFn();
}
