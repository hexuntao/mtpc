import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Tenants table
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).unique(),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    config: jsonb('config'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
    statusIdx: index('tenants_status_idx').on(table.status),
  })
);

/**
 * Permission assignments table (for RBAC extension)
 */
export const permissionAssignments = pgTable(
  'permission_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    subjectType: varchar('subject_type', { length: 50 }).notNull(), // 'user', 'role', 'group'
    subjectId: uuid('subject_id').notNull(),
    permission: varchar('permission', { length: 255 }).notNull(),
    granted: boolean('granted').default(true).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: uuid('created_by'),
  },
  table => ({
    tenantIdx: index('perm_assign_tenant_idx').on(table.tenantId),
    subjectIdx: index('perm_assign_subject_idx').on(
      table.tenantId,
      table.subjectType,
      table.subjectId
    ),
    permissionIdx: index('perm_assign_permission_idx').on(table.tenantId, table.permission),
  })
);

/**
 * Audit log table
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    subjectId: uuid('subject_id'),
    subjectType: varchar('subject_type', { length: 50 }),
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 100 }).notNull(),
    resourceId: uuid('resource_id'),
    changes: jsonb('changes'),
    metadata: jsonb('metadata'),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    tenantIdx: index('audit_tenant_idx').on(table.tenantId),
    subjectIdx: index('audit_subject_idx').on(table.tenantId, table.subjectId),
    resourceIdx: index('audit_resource_idx').on(table.tenantId, table.resource, table.resourceId),
    createdAtIdx: index('audit_created_at_idx').on(table.createdAt),
  })
);

/**
 * Export all system tables
 */
export const systemTables = {
  tenants,
  permissionAssignments,
  auditLogs,
};
