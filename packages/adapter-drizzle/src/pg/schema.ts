import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * MTPC 系统表定义
 * 定义框架所需的系统表结构
 *
 * **包含的表**：
 * - `tenants` - 租户表
 * - `permissionAssignments` - 权限分配表（用于 RBAC）
 * - `auditLogs` - 审计日志表
 */

/**
 * 租户表
 * 存储多租户系统中的租户信息
 *
 * **字段**：
 * - `id` - UUID 主键
 * - `name` - 租户名称
 * - `slug` - 租户标识（唯一）
 * - `status` - 状态（默认 'active'）
 * - `config` - 配置（JSONB）
 * - `metadata` - 元数据（JSONB）
 * - `createdAt` - 创建时间
 * - `updatedAt` - 更新时间
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
 * 权限分配表
 * 存储 RBAC 权限分配信息
 *
 * **字段**：
 * - `id` - UUID 主键
 * - `tenantId` - 租户 ID
 * - `subjectType` - 主体类型（'user'、'role'、'group'）
 * - `subjectId` - 主体 ID
 * - `permission` - 权限字符串
 * - `granted` - 是否授权（默认 true）
 * - `expiresAt` - 过期时间
 * - `createdAt` - 创建时间
 * - `createdBy` - 创建者 ID
 */
export const permissionAssignments = pgTable(
  'permission_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    subjectType: varchar('subject_type', { length: 50 }).notNull(),
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
 * 审计日志表
 * 存储系统操作审计日志
 *
 * **字段**：
 * - `id` - UUID 主键
 * - `tenantId` - 租户 ID
 * - `subjectId` - 操作主体 ID
 * - `subjectType` - 操作主体类型
 * - `action` - 操作动作
 * - `resource` - 资源类型
 * - `resourceId` - 资源 ID
 * - `changes` - 变更内容（JSONB）
 * - `metadata` - 元数据（JSONB）
 * - `ip` - IP 地址
 * - `userAgent` - 用户代理
 * - `createdAt` - 创建时间
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
 * 导出所有系统表
 */
export const systemTables = {
  tenants,
  permissionAssignments,
  auditLogs,
};
