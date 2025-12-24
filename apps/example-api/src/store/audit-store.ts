import { and, asc, count, desc, eq, gte, lte, or, type SQL } from 'drizzle-orm';
import {
  type AuditEntry,
  type AuditQueryFilter,
  type AuditQueryOptions,
  type AuditQueryResult,
  type AuditStore,
} from '@mtpc/audit';
import { db } from '../db/connection.js';
import { auditLogs } from '../db/audit-schema.js';

/**
 * 数据库审计日志存储实现
 *
 * 使用 Drizzle ORM 将审计日志持久化到 PostgreSQL 数据库
 *
 * 特性：
 * - 支持多租户隔离
 * - 高效的索引查询
 * - 支持复杂的过滤条件
 * - 支持分页和排序
 */
export class DatabaseAuditStore implements AuditStore {
  /**
   * 将 AuditEntry 转换为数据库行格式
   */
  private entryToDbRow(entry: AuditEntry) {
    return {
      id: entry.id || crypto.randomUUID(),
      tenantId: entry.tenantId,
      subjectId: entry.subjectId,
      subjectType: entry.subjectType,
      timestamp: entry.timestamp,
      category: entry.category,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      permission: entry.permission,
      decision: entry.decision,
      success: entry.success,
      reason: entry.reason,
      before: entry.before,
      after: entry.after,
      ip: entry.ip,
      userAgent: entry.userAgent,
      requestId: entry.requestId,
      path: entry.path,
      method: entry.method,
      metadata: entry.metadata,
    };
  }

  /**
   * 将数据库行转换为 AuditEntry
   */
  private dbRowToEntry(row: typeof auditLogs.$inferSelect): AuditEntry {
    return {
      id: row.id,
      tenantId: row.tenantId,
      subjectId: row.subjectId,
      subjectType: row.subjectType,
      timestamp: row.timestamp,
      category: row.category as any,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      permission: row.permission,
      decision: row.decision as any,
      success: row.success,
      reason: row.reason,
      before: row.before,
      after: row.after,
      ip: row.ip,
      userAgent: row.userAgent,
      requestId: row.requestId,
      path: row.path,
      method: row.method,
      metadata: row.metadata as any,
    };
  }

  /**
   * 构建查询条件
   */
  private buildWhereClause(filter: AuditQueryFilter) {
    const conditions: SQL[] = [];

    if (filter.tenantId) {
      conditions.push(eq(auditLogs.tenantId, filter.tenantId));
    }
    if (filter.subjectId) {
      conditions.push(eq(auditLogs.subjectId, filter.subjectId));
    }
    if (filter.resource) {
      conditions.push(eq(auditLogs.resource, filter.resource));
    }
    if (filter.resourceId) {
      conditions.push(eq(auditLogs.resourceId, filter.resourceId));
    }
    if (filter.category) {
      conditions.push(eq(auditLogs.category, filter.category));
    }
    if (filter.decision) {
      conditions.push(eq(auditLogs.decision, filter.decision));
    }
    if (filter.action) {
      conditions.push(eq(auditLogs.action, filter.action));
    }
    if (filter.permission) {
      conditions.push(eq(auditLogs.permission, filter.permission));
    }
    if (filter.from) {
      conditions.push(gte(auditLogs.timestamp, filter.from));
    }
    if (filter.to) {
      conditions.push(lte(auditLogs.timestamp, filter.to));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * 记录审计条目
   */
  async log(entry: AuditEntry): Promise<void> {
    const row = this.entryToDbRow(entry);
    await db.insert(auditLogs).values(row);
  }

  /**
   * 查询审计记录
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditQueryResult> {
    const {
      filter = {},
      limit = 50,
      offset = 0,
      orderBy = 'timestamp',
      orderDirection = 'desc',
    } = options;

    const where = this.buildWhereClause(filter);

    // 构建排序
    const orderByClause =
      orderBy === 'timestamp'
        ? orderDirection === 'asc'
          ? asc(auditLogs.timestamp)
          : desc(auditLogs.timestamp)
        : orderBy === 'tenant'
          ? orderDirection === 'asc'
            ? asc(auditLogs.tenantId)
            : desc(auditLogs.tenantId)
          : orderDirection === 'asc'
            ? asc(auditLogs.subjectId)
            : desc(auditLogs.subjectId);

    // 查询记录
    const rows = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // 查询总数
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(auditLogs)
      .where(where);

    return {
      entries: rows.map((row) => this.dbRowToEntry(row)),
      total: Number(total),
      limit,
      offset,
    };
  }

  /**
   * 统计审计记录数量
   */
  async count(filter: AuditQueryFilter = {}): Promise<number> {
    const where = this.buildWhereClause(filter);
    const [{ value }] = await db
      .select({ value: count() })
      .from(auditLogs)
      .where(where);
    return Number(value);
  }

  /**
   * 清除审计记录
   */
  async clear(filter?: AuditQueryFilter): Promise<void> {
    const where = this.buildWhereClause(filter || {});

    if (where) {
      await db.delete(auditLogs).where(where);
    } else {
      // 清空所有记录（谨慎操作）
      await db.delete(auditLogs);
    }
  }
}

/**
 * 创建数据库审计存储实例
 */
export function createDatabaseAuditStore(): DatabaseAuditStore {
  return new DatabaseAuditStore();
}
