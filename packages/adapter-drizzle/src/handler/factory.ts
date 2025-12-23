import type { ResourceDefinition } from '@mtpc/core';
import { toSnakeCase } from '@mtpc/shared';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { CRUDHandler, DrizzleDB } from '../types.js';
import { DrizzleCRUDHandler } from './crud-handler.js';

/**
 * Handler factory for MTPC resources
 */
export class DrizzleHandlerFactory {
  private db: DrizzleDB;
  private tables: Map<string, PgTable>;
  private handlers: Map<string, DrizzleCRUDHandler<any>>;

  constructor(db: DrizzleDB, tables: Record<string, PgTable>) {
    this.db = db;
    this.tables = new Map(Object.entries(tables));
    this.handlers = new Map();
  }

  /**
   * Create handler for resource
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
   * Get factory function for Hono adapter
   */
  getHandlerFactoryFn() {
    return (resource: ResourceDefinition) => this.createHandler(resource);
  }

  /**
   * Register table
   */
  registerTable(name: string, table: PgTable): void {
    this.tables.set(name, table);
  }

  /**
   * Clear handler cache
   */
  clearCache(): void {
    this.handlers.clear();
  }
}

/**
 * Create handler factory
 */
export function createDrizzleHandlerFactory(
  db: DrizzleDB,
  tables: Record<string, PgTable>
): DrizzleHandlerFactory {
  return new DrizzleHandlerFactory(db, tables);
}

/**
 * Create handler factory function for Hono
 */
export function createHandlerFactory(db: DrizzleDB, tables: Record<string, PgTable>) {
  const factory = new DrizzleHandlerFactory(db, tables);
  return factory.getHandlerFactoryFn();
}
