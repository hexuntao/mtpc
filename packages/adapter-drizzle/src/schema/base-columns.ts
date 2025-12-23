import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Common base columns for all tables
 */
export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/**
 * Tenant-scoped columns
 */
export const tenantColumns = {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
};

/**
 * Audit columns
 */
export const auditColumns = {
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
};

/**
 * Soft delete columns
 */
export const softDeleteColumns = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
};

/**
 * Version columns for optimistic locking
 */
export const versionColumns = {
  version: integer('version').default(1).notNull(),
};

/**
 * Create tenant table with common columns
 */
export function createTenantTable<T extends Record<string, unknown>>(
  name: string,
  columns: T,
  options: {
    audit?: boolean;
    softDelete?: boolean;
    version?: boolean;
  } = {}
) {
  const allColumns = {
    ...tenantColumns,
    ...columns,
    ...(options.audit ? auditColumns : {}),
    ...(options.softDelete ? softDeleteColumns : {}),
    ...(options.version ? versionColumns : {}),
  };

  return pgTable(name, allColumns, table => ({
    tenantIdx: index(`${name}_tenant_idx`).on(table.tenantId),
  }));
}

/**
 * Create global table (not tenant-scoped)
 */
export function createGlobalTable<T extends Record<string, unknown>>(
  name: string,
  columns: T,
  options: {
    audit?: boolean;
    softDelete?: boolean;
    version?: boolean;
  } = {}
) {
  const allColumns = {
    ...baseColumns,
    ...columns,
    ...(options.audit ? auditColumns : {}),
    ...(options.softDelete ? softDeleteColumns : {}),
    ...(options.version ? versionColumns : {}),
  };

  return pgTable(name, allColumns);
}
