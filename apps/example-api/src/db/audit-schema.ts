import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

/**
 * MTPC 审计日志表
 *
 * 记录系统中所有与权限相关的操作，包括：
 * - 权限检查
 * - 资源 CRUD 操作
 * - 角色绑定变更
 * - 策略变更
 */
export const auditLogs = pgTable(
  'mtpc_audit_logs',
  {
    // 主键
    id: uuid('id').primaryKey().defaultRandom(),

    // 租户和主体信息
    tenantId: text('tenant_id').notNull(),
    subjectId: text('subject_id'),
    subjectType: text('subject_type'), // 'user' | 'group' | 'service' | 'system'

    // 事件信息
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
    category: text('category').notNull(), // 'permission' | 'resource' | 'role' | 'policy' | 'system' | 'custom'
    action: text('action').notNull(), // 'check', 'create', 'update', 'delete', 'assign', 'revoke', etc.

    // 资源信息
    resource: text('resource'), // 资源名称，如 'product', 'order'
    resourceId: text('resource_id'), // 资源实例 ID
    permission: text('permission'), // 权限编码，如 'product.create'

    // 决策结果
    decision: text('decision').notNull(), // 'allow' | 'deny' | 'error' | 'info'
    success: boolean('success').notNull(),
    reason: text('reason'), // 决策原因或错误消息

    // 状态变更（JSONB 存储）
    before: jsonb('before'), // 操作前状态
    after: jsonb('after'), // 操作后状态

    // 请求上下文
    ip: text('ip'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    path: text('path'),
    method: text('method'),

    // 额外元数据（JSONB 存储）
    metadata: jsonb('metadata'),
  },
  (table) => ({
    // 租户 + 时间戳复合索引（常用查询组合）
    tenantTimestampIdx: index('audit_tenant_timestamp_idx').on(
      table.tenantId,
      table.timestamp
    ),

    // 主体查询索引
    subjectIdx: index('audit_subject_idx').on(
      table.tenantId,
      table.subjectType,
      table.subjectId
    ),

    // 资源查询索引
    resourceIdx: index('audit_resource_idx').on(
      table.tenantId,
      table.resource,
      table.resourceId
    ),

    // 类别查询索引
    categoryIdx: index('audit_category_idx').on(
      table.tenantId,
      table.category,
      table.timestamp
    ),

    // 决策查询索引
    decisionIdx: index('audit_decision_idx').on(
      table.tenantId,
      table.decision,
      table.timestamp
    ),
  })
);

/**
 * 审计日志表类型
 */
export type AuditLog = typeof auditLogs.$inferSelect;

/**
 * 新增审计日志类型
 */
export type NewAuditLog = typeof auditLogs.$inferInsert;
