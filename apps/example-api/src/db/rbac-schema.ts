import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * 角色表
 *
 * 存储租户下的角色定义
 */
export const roles = pgTable('mtpc_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  // 租户 ID，用于多租户隔离
  tenantId: text('tenant_id').notNull(),
  // 角色唯一标识（在租户内唯一）
  name: varchar('name', { length: 100 }).notNull(),
  // 角色显示名称
  displayName: varchar('display_name', { length: 200 }),
  // 角色描述
  description: text('description'),
  // 权限列表（存储为文本数组）
  permissions: text('permissions').array().notNull().default([]),
  // 是否为系统角色（系统角色不可删除）
  isSystem: boolean('is_system').notNull().default(false),
  // 角色继承（父角色 ID 列表）
  inherits: text('inherits').array().notNull().default([]),
  // 创建时间
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // 更新时间
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // 创建者用户 ID
  createdBy: text('created_by'),
  // 更新者用户 ID
  updatedBy: text('updated_by'),
});

/**
 * 角色绑定表
 *
 * 存储角色与主体（用户、组、服务）的绑定关系
 */
export const roleBindings = pgTable('mtpc_role_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),
  // 租户 ID
  tenantId: text('tenant_id').notNull(),
  // 角色 ID（指向 roles.name）
  roleId: text('role_id').notNull(),
  // 主体类型：user, group, service
  subjectType: varchar('subject_type', { length: 50 }).notNull(),
  // 主体 ID
  subjectId: text('subject_id').notNull(),
  // 过期时间（可选，用于临时权限）
  expiresAt: timestamp('expires_at'),
  // 创建时间
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // 创建者用户 ID
  createdBy: text('created_by'),
});

/**
 * 用户表（示例应用专用）
 *
 * 注意：这不是 MTPC 的一部分，而是示例应用用于演示的用户表
 * 实际生产环境中，用户模型应由应用自身定义
 */
export const users = pgTable('example_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // 租户 ID
  tenantId: text('tenant_id').notNull(),
  // 邮箱（登录凭证）
  email: varchar('email', { length: 255 }).notNull().unique(),
  // 密码哈希
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  // 显示名称
  displayName: varchar('display_name', { length: 200 }),
  // 用户状态
  status: varchar('status', { length: 50 })
    .notNull()
    .default('active'), // active, inactive, suspended
  // 是否为租户管理员
  isAdmin: boolean('is_admin').notNull().default(false),
  // 创建时间
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // 更新时间
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // 最后登录时间
  lastLoginAt: timestamp('last_login_at'),
});

/**
 * 角色表类型
 */
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

/**
 * 角色绑定表类型
 */
export type RoleBinding = typeof roleBindings.$inferSelect;
export type NewRoleBinding = typeof roleBindings.$inferInsert;

/**
 * 用户表类型
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
