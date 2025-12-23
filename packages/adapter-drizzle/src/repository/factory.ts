import type { ResourceDefinition } from '@mtpc/core';
import { toSnakeCase } from '@mtpc/shared';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../types.js';
import { TenantRepository } from './tenant-repository.js';

/**
 * Repository factory
 */
export class RepositoryFactory {
  private db: DrizzleDB;
  private tables: Map<string, PgTable>;
  private repositories: Map<string, TenantRepository<any>>;

  constructor(db: DrizzleDB, tables: Record<string, PgTable>) {
    this.db = db;
    this.tables = new Map(Object.entries(tables));
    this.repositories = new Map();
  }

  /**
   * Get repository for resource
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
   * Register table
   */
  registerTable(name: string, table: PgTable): void {
    this.tables.set(name, table);
  }

  /**
   * Get all table names
   */
  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  /**
   * Clear repository cache
   */
  clearCache(): void {
    this.repositories.clear();
  }
}

/**
 * Create repository factory
 */
export function createRepositoryFactory(
  db: DrizzleDB,
  tables: Record<string, PgTable>
): RepositoryFactory {
  return new RepositoryFactory(db, tables);
}
