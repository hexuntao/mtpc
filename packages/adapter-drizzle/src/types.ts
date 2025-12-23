import type { MTPCContext, PaginatedResult, QueryOptions, ResourceDefinition } from '@mtpc/core';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Database instance type
 */
export type DrizzleDB = PostgresJsDatabase<Record<string, never>>;

/**
 * Table schema type
 */
export type TableSchema = Record<string, unknown>;

/**
 * Repository interface
 */
export interface Repository<T> {
  findById(ctx: MTPCContext, id: string): Promise<T | null>;
  findMany(ctx: MTPCContext, options?: QueryOptions): Promise<PaginatedResult<T>>;
  create(ctx: MTPCContext, data: Partial<T>): Promise<T>;
  update(ctx: MTPCContext, id: string, data: Partial<T>): Promise<T | null>;
  delete(ctx: MTPCContext, id: string): Promise<boolean>;
  count(ctx: MTPCContext, options?: QueryOptions): Promise<number>;
}

/**
 * Database config
 */
export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeout?: number;
  ssl?: boolean | object;
}

/**
 * Schema generation options
 */
export interface SchemaGenerationOptions {
  tenantColumn?: string;
  timestamps?: boolean;
  softDelete?: boolean;
  auditFields?: boolean;
}

/**
 * Column definition from Zod schema
 */
export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  primaryKey?: boolean;
  unique?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

/**
 * Table definition
 */
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes?: IndexDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
}

/**
 * Index definition
 */
export interface IndexDefinition {
  name: string;
  columns: string[];
  unique?: boolean;
}

/**
 * Foreign key definition
 */
export interface ForeignKeyDefinition {
  name: string;
  columns: string[];
  references: {
    table: string;
    columns: string[];
  };
  onDelete?: 'cascade' | 'set null' | 'restrict' | 'no action';
  onUpdate?: 'cascade' | 'set null' | 'restrict' | 'no action';
}
