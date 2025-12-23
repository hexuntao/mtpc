import { index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * 基础列定义集合
 * 提供通用的表列定义，用于快速创建表
 */

/**
 * 通用基础列
 * 所有表的默认列
 *
 * **包含**：
 * - `id` - UUID 主键
 * - `createdAt` - 创建时间戳
 * - `updatedAt` - 更新时间戳
 */
export const baseColumns = {
  /** UUID 主键，自动生成 */
  id: uuid('id').primaryKey().defaultRandom(),
  /** 创建时间，带时区 */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  /** 更新时间，带时区 */
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

/**
 * 租户相关列
 * 用于多租户隔离的表
 *
 * **包含**：
 * - 所有基础列
 * - `tenantId` - 租户 ID
 */
export const tenantColumns = {
  ...baseColumns,
  /** 租户 ID，非空 */
  tenantId: uuid('tenant_id').notNull(),
};

/**
 * 审计列
 * 用于记录创建和修改者
 *
 * **包含**：
 * - `createdBy` - 创建者 ID
 * - `updatedBy` - 更新者 ID
 */
export const auditColumns = {
  /** 创建者 UUID */
  createdBy: uuid('created_by'),
  /** 更新者 UUID */
  updatedBy: uuid('updated_by'),
};

/**
 * 软删除列
 * 用于实现软删除功能
 *
 * **包含**：
 * - `deletedAt` - 删除时间
 * - `deletedBy` - 删除者 ID
 */
export const softDeleteColumns = {
  /** 删除时间，带时区 */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  /** 删除者 UUID */
  deletedBy: uuid('deleted_by'),
};

/**
 * 乐观锁版本列
 * 用于实现乐观锁
 *
 * **包含**：
 * - `version` - 版本号
 */
export const versionColumns = {
  /** 版本号，从 1 开始 */
  version: integer('version').default(1).notNull(),
};

/**
 * 创建租户表
 * 带有租户隔离的表，包含租户 ID 列
 *
 * @param name - 表名
 * @param columns - 自定义列定义
 * @param options - 可选配置
 * @returns Drizzle 表定义
 *
 * **选项**：
 * - `audit` - 添加审计字段
 * - `softDelete` - 添加软删除字段
 * - `version` - 添加版本字段
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

  return pgTable(name, allColumns as any, table => ({
    tenantIdx: index(`${name}_tenant_idx`).on(table.tenantId),
  }));
}

/**
 * 创建全局表
 * 不带租户隔离的表
 *
 * @param name - 表名
 * @param columns - 自定义列定义
 * @param options - 可选配置
 * @returns Drizzle 表定义
 *
 * **选项**：
 * - `audit` - 添加审计字段
 * - `softDelete` - 添加软删除字段
 * - `version` - 添加版本字段
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

  return pgTable(name, allColumns as any);
}
